pub(crate) fn discover_handlers(
    config_layer_stack: Option<&ConfigLayerStack>,
    plugin_hook_sources: Vec<PluginHookSource>,
    plugin_hook_load_warnings: Vec<String>,
    bypass_hook_trust: bool,
) -> DiscoveryResult {
    let mut handlers = Vec::new();
    let mut hook_entries = Vec::new();
    let mut warnings = plugin_hook_load_warnings;
    let mut required_load_errors = Vec::new();
    let mut display_order = 0_i64;
    let mut visited_json_hook_folders = HashSet::new();
    let hook_states = hook_states_from_stack(config_layer_stack);
    let policy = HookDiscoveryPolicy {
        allow_managed_hooks_only: config_layer_stack.is_some_and(|config_layer_stack| {
            config_layer_stack
                .requirements()
                .allow_managed_hooks_only
                .as_ref()
                .is_some_and(|requirement| requirement.value)
        }),
        bypass_hook_trust,
    };

    if let Some(config_layer_stack) = config_layer_stack {
        required_load_errors = append_managed_requirement_handlers(
            &mut handlers,
            &mut hook_entries,
            &mut warnings,
            &mut display_order,
            config_layer_stack,
            &hook_states,
            policy,
        );

        for layer in config_layer_stack.layers_low_to_high() {
            let (hook_source, is_managed) = hook_metadata_for_config_layer_source(&layer.name);
            let policy_path = config_toml_source_path(layer);
            let policy_source = HookHandlerSource {
                path: &policy_path,
                key_source: policy_path.display().to_string(),
                source: hook_source,
                is_managed,
                requirement: HookRequirement::Optional,
                bypass_hook_trust: false,
                hook_states: &hook_states,
                env: HashMap::new(),
                plugin_id: None,
            };
            if !policy.allows(&policy_source) {
                continue;
            }
            let json_hooks = match layer.hooks_config_folder() {
                Some(config_folder) if visited_json_hook_folders.insert(config_folder.clone()) => {
                    load_hooks_json(Some(config_folder.as_path()), &mut warnings)
                }
                _ => None,
            };
            let toml_hooks = load_toml_hooks_from_layer(layer, &mut warnings);

            if let (Some((json_source_path, json_events)), Some((toml_source_path, toml_events))) =
                (&json_hooks, &toml_hooks)
                && !json_events.is_empty()
                && !toml_events.is_empty()
            {
                warnings.push(format!(
                    "loading hooks from both {} and {}; prefer a single representation for this layer",
                    json_source_path.display(),
                    toml_source_path.display()
                ));
            }

            for (source_path, hook_events) in [json_hooks, toml_hooks].into_iter().flatten() {
                append_hook_events(
                    &mut handlers,
                    &mut hook_entries,
                    &mut warnings,
                    &mut display_order,
                    HookHandlerSource {
                        path: &source_path,
                        key_source: source_path.display().to_string(),
                        source: hook_source,
                        is_managed,
                        requirement: HookRequirement::Optional,
                        bypass_hook_trust: policy.bypass_hook_trust,
                        hook_states: &hook_states,
                        env: HashMap::new(),
                        plugin_id: None,
                    },
                    hook_events,
                    policy,
                );
            }
        }
    }

    append_plugin_hook_sources(
        &mut handlers,
        &mut hook_entries,
        &mut warnings,
        &mut display_order,
        plugin_hook_sources,
        &hook_states,
        policy,
    );

    DiscoveryResult {
        handlers,
        hook_entries,
        warnings,
        required_load_errors,
    }
}

fn append_managed_requirement_handlers(
    handlers: &mut Vec<ConfiguredHandler>,
    hook_entries: &mut Vec<HookListEntry>,
    warnings: &mut Vec<String>,
    display_order: &mut i64,
    config_layer_stack: &ConfigLayerStack,
    hook_states: &HashMap<String, HookStateToml>,
    policy: HookDiscoveryPolicy,
) -> Vec<String> {
    let Some(managed_hooks) = config_layer_stack.requirements().managed_hooks.as_ref() else {
        return Vec::new();
    };
    let mut required_load_errors = Vec::new();
    let source_path = managed_hooks_source_path(managed_hooks.get(), managed_hooks.source.as_ref());
    append_hook_events(
        handlers,
        hook_entries,
        warnings,
        display_order,
        HookHandlerSource {
            path: &source_path,
            key_source: source_path.display().to_string(),
            source: hook_source_for_requirement_source(managed_hooks.source.as_ref()),
            is_managed: true,
            requirement: HookRequirement::Required(&mut required_load_errors),
            bypass_hook_trust: false,
            hook_states,
            env: HashMap::new(),
            plugin_id: None,
        },
        managed_hooks.get().hooks.clone(),
        policy,
    );
    required_load_errors
}

fn append_plugin_hook_sources(
    handlers: &mut Vec<ConfiguredHandler>,
    hook_entries: &mut Vec<HookListEntry>,
    warnings: &mut Vec<String>,
    display_order: &mut i64,
    plugin_hook_sources: Vec<PluginHookSource>,
    hook_states: &HashMap<String, HookStateToml>,
    policy: HookDiscoveryPolicy,
) {
    for source in plugin_hook_sources {
        let PluginHookSource {
            plugin_root,
            plugin_id,
            plugin_data_root,
            source_path,
            source_relative_path,
            hooks,
        } = source;
        let mut env = HashMap::new();
        let plugin_root_value = plugin_root.display().to_string();
        let plugin_data_root_value = plugin_data_root.display().to_string();
        env.insert("PLUGIN_ROOT".to_string(), plugin_root_value.clone());
        // For OOTB compat with existing plugins that use this env var.
        env.insert("CLAUDE_PLUGIN_ROOT".to_string(), plugin_root_value);
        env.insert("PLUGIN_DATA".to_string(), plugin_data_root_value.clone());
        // For OOTB compat with existing plugins that use this env var.
        env.insert("CLAUDE_PLUGIN_DATA".to_string(), plugin_data_root_value);
        let plugin_id = plugin_id.as_key();
        append_hook_events(
            handlers,
            hook_entries,
            warnings,
            display_order,
            HookHandlerSource {
                path: &source_path,
                key_source: crate::declarations::plugin_hook_key_source(
                    plugin_id.as_str(),
                    source_relative_path.as_str(),
                ),
                source: HookSource::Plugin,
                is_managed: false,
                requirement: HookRequirement::Optional,
                bypass_hook_trust: policy.bypass_hook_trust,
                hook_states,
                env,
                plugin_id: Some(plugin_id),
            },
            hooks,
            policy,
        );
    }
}

fn managed_hooks_source_path(
    managed_hooks: &ManagedHooksRequirementsToml,
    requirement_source: Option<&RequirementSource>,
) -> AbsolutePathBuf {
    if let Some(source_path) = managed_hooks.managed_dir_for_current_platform()
        && source_path.is_absolute()
        && let Ok(source_path) = AbsolutePathBuf::from_absolute_path(source_path)
    {
        return source_path;
    }

    fallback_managed_hooks_source_path(requirement_source)
}

fn fallback_managed_hooks_source_path(
    requirement_source: Option<&RequirementSource>,
) -> AbsolutePathBuf {
    match requirement_source {
        Some(RequirementSource::SystemRequirementsToml { file })
        | Some(RequirementSource::LegacyManagedConfigTomlFromFile { file }) => file.clone(),
        Some(RequirementSource::MdmManagedPreferences { domain, key }) => {
            synthetic_layer_path(&format!("<mdm:{domain}:{key}>/requirements.toml"))
        }
        Some(RequirementSource::Composite { .. }) => {
            synthetic_layer_path("<requirements-composition>/requirements.toml")
        }
        Some(RequirementSource::EnterpriseManaged { id, name }) => {
            let name = escape_xml_text(name);
            let id = escape_xml_text(id);
            synthetic_layer_path(&format!(
                "<enterprise-managed:{name}:{id}>/requirements.toml"
            ))
        }
        Some(RequirementSource::LegacyManagedConfigTomlFromMdm) => {
            synthetic_layer_path("<legacy-managed-config.toml-mdm>/managed_config.toml")
        }
        Some(RequirementSource::Unknown) | None => {
            synthetic_layer_path("<managed-requirements>/requirements.toml")
        }
    }
}

fn load_hooks_json(
    config_folder: Option<&Path>,
    warnings: &mut Vec<String>,
) -> Option<(AbsolutePathBuf, HookEventsToml)> {
    let source_path = config_folder?.join("hooks.json");
    if !source_path.as_path().is_file() {
        return None;
    }

    let contents = match fs::read_to_string(source_path.as_path()) {
        Ok(contents) => contents,
        Err(err) => {
            warnings.push(format!(
                "failed to read hooks config {}: {err}",
                source_path.display()
            ));
            return None;
        }
    };

    let parsed: HooksFile = match serde_json::from_str(&contents) {
        Ok(parsed) => parsed,
        Err(err) => {
            warnings.push(format!(
                "failed to parse hooks config {}: {err}",
                source_path.display()
            ));
            return None;
        }
    };

    let source_path = AbsolutePathBuf::from_absolute_path(&source_path)
        .inspect_err(|err| {
            warnings.push(format!(
                "failed to normalize hooks config path {}: {err}",
                source_path.display()
            ));
        })
        .ok()?;

    (!parsed.hooks.is_empty()).then_some((source_path, parsed.hooks))
}

fn load_toml_hooks_from_layer(
    layer: &ConfigLayerEntry,
    warnings: &mut Vec<String>,
) -> Option<(AbsolutePathBuf, HookEventsToml)> {
    let source_path = config_toml_source_path(layer);
    let hook_value = layer.config.get("hooks")?.clone();
    let parsed = match HookEventsToml::deserialize(hook_value) {
        Ok(parsed) => parsed,
        Err(err) => {
            warnings.push(format!(
                "failed to parse TOML hooks in {}: {err}",
                source_path.display()
            ));
            return None;
        }
    };

    (!parsed.is_empty()).then_some((source_path, parsed))
}
