---
name: Git LFS access
description: Repository-specific constraint for syncing large Git LFS assets from GitHub.
---

This repository tracks some large export/media files with Git LFS. Source code can be available from cached Git refs even when LFS downloads fail, but a valid GitHub authorization is required to fetch the large binary contents.

**Why:** The Git remote rejected the available credentials during both normal pull and LFS smudge, while the cached remote commit still contained the application source.

**How to apply:** Prefer syncing source with LFS smudge disabled when validating or editing code. Do not claim all binary exports are available until GitHub/LFS access has been reauthorized.