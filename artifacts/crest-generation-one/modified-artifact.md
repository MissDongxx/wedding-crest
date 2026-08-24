# Crest generation = one artifact

The production sources remain in the repository. This directory contains a
post-change snapshot under `modified/`, with hashes in `modified-hashes.txt`.

Changed behavior:

- `WEDDING_MAX_CANDIDATES` is `1`.
- The job polling/quota path uses that same constant instead of a hard-coded
  batch size of `3`.
- Create and design copy no longer promises three candidates.

The pre-change snapshot is under `original/`; `rollback.sh` restores exactly
those files without touching unrelated worktree changes.
