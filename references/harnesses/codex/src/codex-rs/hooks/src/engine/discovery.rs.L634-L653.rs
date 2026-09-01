                HookHandlerConfig::Prompt {} => {
                    source.record_load_failure(
                        format!(
                            "skipping prompt hook in {}: prompt hooks are not supported yet",
                            source.path.display()
                        ),
                        warnings,
                    );
                    continue;
                }
                HookHandlerConfig::Agent {} => {
                    source.record_load_failure(
                        format!(
                            "skipping agent hook in {}: agent hooks are not supported yet",
                            source.path.display()
                        ),
                        warnings,
                    );
                    continue;
                }
