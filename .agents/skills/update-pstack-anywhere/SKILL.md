---
name: update-pstack-anywhere
description: Update this pstack-anywhere source checkout from Cursor pstack, or resume an interrupted upstream update. Installed copies are refreshed through their existing skill manager.
---

# Update pstack-anywhere

Read the checkout's [README](../../../README.md) and follow the
[refresh procedure](../../../UPSTREAM.md#refresh). Run commands at its Git root.
This is a repository maintenance skill, separate from the distributed skill pack.

For a new update, record the current commit and preserve any pending work before
the import. Select one full upstream SHA and keep it fixed through review.
For an interrupted update, inspect Git's active operation and the saved update
report before deciding whether to continue or abort. An existing merge is work
to reconcile, not permission to restart over it.

Account for every changed upstream path in the update report, including clean
merges, additions, deletions, packaging, and setup-skill renames. Review the
meaning of new instructions as well as the tokens the portability checker knows.
Keep the divergence decisions in UPSTREAM.md and substitutions in coupling.yaml.

Exercise the procedure against the requested update. When a failure exposes a
workflow defect, reproduce it in an isolated Git fixture, fix it, and rerun the
affected checks. Completion requires the refresh procedure's validation and a
report of any behavior that remains unverified. Passing tests establish their
listed invariants, not certainty about all future upstream changes.

Publish and refresh installations only within the user's authorization. Name
the upstream SHA, resulting port commit, validation results, and installation
state separately. A local merge is not a published or installed update.
