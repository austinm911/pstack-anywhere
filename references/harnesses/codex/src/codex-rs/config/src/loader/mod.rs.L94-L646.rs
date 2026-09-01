/// To build up the set of admin-enforced constraints, requirements layers are
/// collected in ascending precedence order, matching config layers, and then
/// composed with config-style TOML merging plus field-specific handling for
/// hooks, rules, deny-read permissions, and remote sandbox config:
///
/// - system    `/etc/codex/requirements.toml` (Unix) or
///   `%ProgramData%\OpenAI\Codex\requirements.toml` (Windows)
/// - cloud:    enterprise-managed cloud config bundle requirements
/// - legacy:   `/etc/codex/managed_config.toml` (Unix) reinterpreted as
///   requirements.toml
/// - admin:    managed preferences (*)
///
/// For backwards compatibility, Unix continues to load
/// `/etc/codex/managed_config.toml` and map it to `requirements.toml`.
///
/// Configuration is built up from multiple layers in the following order:
///
/// - package:  optional default configuration supplied with the Codex package
/// - admin:    managed preferences (*)
/// - system    `/etc/codex/config.toml` (Unix) or
///   `%ProgramData%\OpenAI\Codex\config.toml` (Windows)
/// - cloud     enterprise-managed cloud config bundle fragments
/// - user      `${CODEX_HOME}/config.toml`
/// - profile   `${CODEX_HOME}/<name>.config.toml`, when selected
/// - cwd       `${PWD}/config.toml` (loaded but disabled when the directory is untrusted)
/// - tree      parent directories up to root looking for `./.codex/config.toml` (loaded but disabled when untrusted)
/// - repo      `$(git rev-parse --show-toplevel)/.codex/config.toml` (loaded but disabled when untrusted)
/// - runtime   e.g., --config flags, model selector in UI
///
/// (*) Only available on macOS via managed device profiles.
///
/// See https://developers.openai.com/codex/security for details.
///
/// When loading the config stack for a thread, there should be a `cwd`
/// associated with it such that `cwd` should be `Some(...)`. Only for
/// thread-agnostic config loading (e.g., for the app server's `/config`
/// endpoint) should `cwd` be `None`.
#[allow(clippy::too_many_arguments)]
pub async fn load_config_layers_state(
    fs: &dyn ExecutorFileSystem,
    codex_home: &Path,
    cwd: Option<AbsolutePathBuf>,
    cli_overrides: &[(String, TomlValue)],
    options: impl Into<ConfigLoadOptions>,
    thread_config_loader: &dyn ThreadConfigLoader,
) -> io::Result<ConfigLayerStack> {
    let ConfigLoadOptions {
        loader_overrides: overrides,
        strict_config,
        cloud_config_bundle,
    } = options.into();
    let packaged_defaults_layer = if let Some(file) = &overrides.packaged_defaults_path {
        let config = layer_io::read_config_from_path(
            fs,
            file,
            /*log_missing_as_info*/ false,
            strict_config,
        )
        .await?
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                format!("packaged defaults config file {} not found", file.display()),
            )
        })?;
        let base_dir = file.as_path().parent().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                format!(
                    "packaged defaults config file {} has no parent directory",
                    file.display()
                ),
            )
        })?;
        ConfigLayerEntry::new(
            ConfigLayerSource::PackagedDefaults { file: file.clone() },
            resolve_relative_paths_in_config_toml(config, base_dir)?,
        )
    } else {
        let file = AbsolutePathBuf::from_absolute_path(std::env::current_exe()?)?;
        let raw_toml = include_str!("../../defaults.toml");
        let config = toml::from_str(raw_toml).map_err(|error| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                format!("invalid embedded packaged defaults; this is a Codex build error: {error}"),
            )
        })?;
        ConfigLayerEntry::new_with_raw_toml(
            ConfigLayerSource::PackagedDefaults { file },
            config,
            raw_toml.to_owned(),
            AbsolutePathBuf::from_absolute_path(codex_home)?,
        )
    };
    let active_user_profile = overrides.user_config_profile.clone();
    let ignore_managed_requirements = overrides.ignore_managed_requirements;
    let ignore_user_config = overrides.ignore_user_config;
    let ignore_project_config = overrides.ignore_project_config;
    let ignore_user_and_project_exec_policy_rules =
        overrides.ignore_user_and_project_exec_policy_rules;
    let mut requirements_layers = Vec::new();
    let mut bundle_requirements_layers = Vec::new();
    let mut system_requirements_layer = None;
    let managed_preferences_requirements_layer;
    let mut cloud_config_layers = Vec::new();

    if !ignore_managed_requirements {
        if let Some(bundle) = cloud_config_bundle.get().await.map_err(io::Error::other)? {
            let cloud_config_base_dir = AbsolutePathBuf::from_absolute_path(codex_home)?;
            let bundle_layers = if strict_config {
                CloudConfigBundleLayers::from_bundle_strict_config(bundle, &cloud_config_base_dir)?
            } else {
                CloudConfigBundleLayers::from_bundle(bundle, &cloud_config_base_dir)?
            };
            let CloudConfigBundleLayers {
                enterprise_managed_config,
                enterprise_managed_requirements,
            } = bundle_layers;
            bundle_requirements_layers = enterprise_managed_requirements;
            cloud_config_layers = enterprise_managed_config;
        }

        #[cfg(target_os = "macos")]
        {
            let managed_preferences_base_dir = AbsolutePathBuf::from_absolute_path(codex_home)?;
            managed_preferences_requirements_layer = macos::load_managed_admin_requirements_layer(
                overrides
                    .macos_managed_config_requirements_base64
                    .as_deref(),
            )
            .await?
            .map(|layer| layer.with_base_dir(managed_preferences_base_dir));
        }
        #[cfg(not(target_os = "macos"))]
        {
            managed_preferences_requirements_layer = None;
        }

        // Honor the system requirements.toml location.
        let requirements_toml_file = system_requirements_toml_file_with_overrides(&overrides)?;
        system_requirements_layer = load_requirements_toml(fs, &requirements_toml_file).await?;
    } else {
        managed_preferences_requirements_layer = None;
    }

    let loaded_config_layers =
        layer_io::load_config_layers_internal(fs, codex_home, overrides.clone(), strict_config)
            .await?;
    let mut startup_warnings = (!loaded_config_layers.startup_warnings.is_empty())
        .then(|| loaded_config_layers.startup_warnings.clone());
    if !ignore_managed_requirements {
        requirements_layers.extend(system_requirements_layer);
        requirements_layers.extend(bundle_requirements_layers);
        // Continue to support loaded legacy `managed_config.toml` sources as
        // requirements layers for backwards compatibility.
        requirements_layers.extend(requirements_layers_from_legacy_scheme(
            loaded_config_layers.clone(),
            codex_home,
        )?);
        requirements_layers.extend(managed_preferences_requirements_layer);
    }

    let mut config_requirements_toml =
        compose_requirements(requirements_layers)?.unwrap_or_default();
    // Remote app servers enforce auth policy for their workspaces; do not let local
    // requirements reintroduce authentication restrictions for those workspaces.
    if overrides.ignore_login_requirements {
        config_requirements_toml.allowed_login_methods = None;
        config_requirements_toml.allowed_chatgpt_workspaces = None;
    }

    let thread_config_context = ThreadConfigContext {
        thread_id: None,
        cwd: cwd.clone(),
    };
    let thread_config_layers = thread_config_loader
        .load_config_layers(thread_config_context)
        .await
        .map_err(io::Error::other)?;

    let mut layers = Vec::<ConfigLayerEntry>::new();
    layers.push(packaged_defaults_layer);

    let cli_overrides_layer = if cli_overrides.is_empty() {
        None
    } else {
        let cli_overrides_layer = build_cli_overrides_layer(cli_overrides);
        let base_dir = cwd
            .as_ref()
            .map(AbsolutePathBuf::as_path)
            .unwrap_or(codex_home);
        if strict_config {
            validate_cli_overrides_strictly(&cli_overrides_layer, base_dir)?;
        }
        Some(resolve_relative_paths_in_config_toml(
            cli_overrides_layer,
            base_dir,
        )?)
    };

    // Include an entry for the "system" config folder, loading its config.toml,
    // if it exists.
    let system_config_toml_file = system_config_toml_file_with_overrides(&overrides)?;
    let system_layer = load_config_toml_for_required_layer(
        fs,
        &system_config_toml_file,
        strict_config,
        |config_toml| {
            ConfigLayerEntry::new(
                ConfigLayerSource::System {
                    file: system_config_toml_file.clone(),
                },
                config_toml,
            )
        },
    )
    .await?;
    layers.push(system_layer);
    layers.extend(cloud_config_layers);

    // Add the base user config layer. When profile-v2 is selected, add the
    // profile config as a second user layer on top so the profile only needs to
    // contain overrides.
    let active_user_file = overrides.user_config_path(codex_home)?;
    let base_user_file = AbsolutePathBuf::resolve_path_against_base(CONFIG_TOML_FILE, codex_home);
    let base_user_layer = load_user_config_layer(
        fs,
        &base_user_file,
        /*profile*/ None,
        ignore_user_config,
        strict_config,
    )
    .await?;
    if let Some(active_user_profile) = active_user_profile.as_ref()
        && let Some(base_user_config) = base_user_layer.config.as_table()
    {
        let legacy_profile_is_selected = base_user_config
            .get("profile")
            .and_then(TomlValue::as_str)
            .is_some_and(|profile| profile == active_user_profile.as_str());
        let legacy_profile_table_exists = base_user_config
            .get("profiles")
            .and_then(TomlValue::as_table)
            .is_some_and(|profiles| profiles.contains_key(active_user_profile.as_str()));
        if legacy_profile_is_selected || legacy_profile_table_exists {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!(
                    "--profile `{active_user_profile}` cannot be used while {} contains legacy `profile = \"{active_user_profile}\"` or `[profiles.{active_user_profile}]` config; move those settings into {} and remove the legacy profile selector/table. See https://developers.openai.com/codex/config-advanced#profiles for more information.",
                    base_user_file.as_path().display(),
                    active_user_file.as_path().display()
                ),
            ));
        }
    }
    layers.push(base_user_layer);

    if active_user_file != base_user_file {
        layers.push(
            load_user_config_layer(
                fs,
                &active_user_file,
                active_user_profile.as_ref(),
                ignore_user_config,
                strict_config,
            )
            .await?,
        );
    }

    if !ignore_project_config && let Some(cwd) = cwd {
        let mut merged_so_far = TomlValue::Table(toml::map::Map::new());
        for layer in &layers {
            merge_toml_values(&mut merged_so_far, &layer.config);
        }
        if let Some(cli_overrides_layer) = cli_overrides_layer.as_ref() {
            merge_toml_values(&mut merged_so_far, cli_overrides_layer);
        }
        // Managed config wins over CLI config. Apply it before choosing the
        // project root and trust, but keep its final layers above project config.
        project_discovery::merge_managed_config_for_discovery(
            &mut merged_so_far,
            &loaded_config_layers,
            codex_home,
        )?;

        let project_root_markers = match project_root_markers_from_config(&merged_so_far) {
            Ok(markers) => markers.unwrap_or_else(default_project_root_markers),
            Err(err) => {
                if let Some(config_error) = first_layer_config_error_from_entries(&layers).await {
                    return Err(io_error_from_config_error(
                        io::ErrorKind::InvalidData,
                        config_error,
                        /*source*/ None,
                    ));
                }
                return Err(err);
            }
        };
        let mut project_trust_context = match project_trust_context(
            fs,
            &merged_so_far,
            &credential_broker_trusted_config(
                &merged_so_far,
                &thread_config_layers,
                &loaded_config_layers,
            ),
            &cwd,
            &project_root_markers,
            codex_home,
            &active_user_file,
        )
        .await
        {
            Ok(context) => context,
            Err(err) => {
                let source = err
                    .get_ref()
                    .and_then(|err| err.downcast_ref::<toml::de::Error>())
                    .cloned();
                if let Some(config_error) = first_layer_config_error_from_entries(&layers).await {
                    return Err(io_error_from_config_error(
                        io::ErrorKind::InvalidData,
                        config_error,
                        source,
                    ));
                }
                return Err(err);
            }
        };
        apply_credential_broker_requirements(&mut project_trust_context, &config_requirements_toml);
        let project_layers = load_project_layers(
            fs,
            &cwd,
            &project_trust_context.project_root,
            &project_trust_context,
            codex_home,
            strict_config,
        )
        .await?;
        layers.extend(project_layers.layers);
        startup_warnings
            .get_or_insert_with(Vec::new)
            .extend(project_layers.startup_warnings);
    }

    // Add a layer for runtime overrides from the CLI or UI, if any exist.
    if let Some(cli_overrides_layer) = cli_overrides_layer {
        layers.push(ConfigLayerEntry::new(
            ConfigLayerSource::SessionFlags,
            cli_overrides_layer,
        ));
    }

    for thread_config_layer in thread_config_layers {
        insert_layer_by_precedence(&mut layers, thread_config_layer);
    }

    // Make a best-effort to support the legacy `managed_config.toml` as a
    // config layer on top of everything else. For fields in
    // `managed_config.toml` that do not have an equivalent in
    // `ConfigRequirements`, note users can still override these values on a
    // per-turn basis in the TUI and VS Code.
    let LoadedConfigLayers {
        managed_config,
        managed_config_from_mdm,
        ..
    } = loaded_config_layers;
    if let Some(config) = managed_config {
        let managed_parent = config.file.as_path().parent().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                format!(
                    "Managed config file {} has no parent directory",
                    config.file.as_path().display()
                ),
            )
        })?;
        let managed_config =
            resolve_relative_paths_in_config_toml(config.managed_config, managed_parent)?;
        layers.push(ConfigLayerEntry::new(
            ConfigLayerSource::LegacyManagedConfigTomlFromFile { file: config.file },
            managed_config,
        ));
    }
    if let Some(config) = managed_config_from_mdm {
        // As a general rule, config from MDM should _not_ include relative
        // paths, starting with `./`, but a path starting with `~/` _is_ a
        // supported use case. Because resolve_relative_paths_in_config_toml()
        // relies on AbsolutePathBufGuard to resolve `~/`, we must supply a
        // value for base_dir. Preserve that same base on the layer so later
        // raw-TOML diagnostics parse with the same path semantics.
        let raw_toml_base_dir = AbsolutePathBuf::from_absolute_path(codex_home)?;
        let managed_config = resolve_relative_paths_in_config_toml(
            config.managed_config,
            raw_toml_base_dir.as_path(),
        )?;
        layers.push(ConfigLayerEntry::new_with_raw_toml(
            ConfigLayerSource::LegacyManagedConfigTomlFromMdm,
            managed_config,
            config.raw_toml,
            raw_toml_base_dir,
        ));
    }

    if let Err(err) = validate_enabled_config_layers(&layers) {
        if let Some(config_error) = typed_first_layer_config_error_from_entries::<
            ShellEnvironmentPolicyFilterConfigToml,
        >(&layers, CONFIG_TOML_FILE)
        .await
        {
            return Err(io_error_from_config_error(
                io::ErrorKind::InvalidData,
                config_error,
                /*source*/ None,
            ));
        }
        return Err(err);
    }

    let config_layer_stack = ConfigLayerStack::new(
        layers,
        config_requirements_toml.clone().try_into()?,
        config_requirements_toml.into_toml(),
    )?
    .with_user_and_project_exec_policy_rules_ignored(ignore_user_and_project_exec_policy_rules);
    Ok(match startup_warnings {
        Some(startup_warnings) => config_layer_stack.with_startup_warnings(startup_warnings),
        None => config_layer_stack,
    })
}

async fn load_user_config_layer(
    fs: &dyn ExecutorFileSystem,
    user_file: &AbsolutePathBuf,
    profile: Option<&ProfileV2Name>,
    ignore_user_config: bool,
    strict_config: bool,
) -> io::Result<ConfigLayerEntry> {
    let profile = profile.map(ToString::to_string);
    if ignore_user_config {
        return Ok(ConfigLayerEntry::new(
            ConfigLayerSource::User {
                file: user_file.clone(),
                profile,
            },
            TomlValue::Table(toml::map::Map::new()),
        ));
    }

    load_config_toml_for_required_layer(fs, user_file, strict_config, |config_toml| {
        ConfigLayerEntry::new(
            ConfigLayerSource::User {
                file: user_file.clone(),
                profile: profile.clone(),
            },
            config_toml,
        )
    })
    .await
}

fn insert_layer_by_precedence(layers: &mut Vec<ConfigLayerEntry>, layer: ConfigLayerEntry) {
    match layers
        .iter()
        .position(|existing| existing.name.precedence() > layer.name.precedence())
    {
        Some(index) => layers.insert(index, layer),
        None => layers.push(layer),
    }
}

/// Attempts to load a config.toml file from `config_toml`.
/// - If the file exists and is valid TOML, passes the parsed `toml::Value` to
///   `create_entry` and returns the resulting layer entry.
/// - If the file does not exist, uses an empty `Table` with `create_entry` and
///   returns the resulting layer entry.
/// - If there is an error reading the file or parsing the TOML, returns an
///   error.
async fn load_config_toml_for_required_layer(
    fs: &dyn ExecutorFileSystem,
    toml_file: &AbsolutePathBuf,
    strict_config: bool,
    create_entry: impl FnOnce(TomlValue) -> ConfigLayerEntry,
) -> io::Result<ConfigLayerEntry> {
    let loaded = load_config_toml_for_required_layer_raw(fs, toml_file, strict_config).await?;
    let toml_value = resolve_relative_paths_in_config_toml(loaded.toml, loaded.base_dir.as_path())?;

    Ok(create_entry(toml_value))
}

#[derive(Debug, Clone)]
struct LoadedTomlFile {
    toml: TomlValue,
    base_dir: AbsolutePathBuf,
}

async fn load_config_toml_for_required_layer_raw(
    fs: &dyn ExecutorFileSystem,
    toml_file: &AbsolutePathBuf,
    strict_config: bool,
) -> io::Result<LoadedTomlFile> {
    let config_parent = toml_file.as_path().parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "Config file {} has no parent directory",
                toml_file.as_path().display()
            ),
        )
    })?;
    let base_dir = AbsolutePathBuf::from_absolute_path(config_parent)?;
    let toml_file_uri = PathUri::from_abs_path(toml_file);
    let toml_value = match fs
        .read_file_text(&toml_file_uri, Default::default(), /*sandbox*/ None)
        .await
    {
        Ok(contents) => {
            let config: TomlValue = toml::from_str(&contents).map_err(|err| {
                let config_error =
                    config_error_from_toml(toml_file.as_path(), &contents, err.clone());
                io_error_from_config_error(io::ErrorKind::InvalidData, config_error, Some(err))
            })?;
            if strict_config {
                validate_config_toml_strictly(
                    toml_file.as_path(),
                    &contents,
                    &config,
                    config_parent,
                )?;
            }
            Ok(config)
        }
        Err(e) => {
            if e.kind() == io::ErrorKind::NotFound {
                Ok(TomlValue::Table(toml::map::Map::new()))
            } else {
                Err(io::Error::new(
                    e.kind(),
                    format!(
                        "Failed to read config file {}: {e}",
                        toml_file.as_path().display()
                    ),
                ))
            }
        }
    }?;

    Ok(LoadedTomlFile {
        toml: toml_value,
        base_dir,
    })
}
