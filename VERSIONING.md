# Versioning

This project uses **semantic versioning** and **Conventional Commits** to automatically determine version numbers and generate changelogs.

## How versions are determined

semantic‑release analyzes commit messages and decides whether the next version is:

- **major** (`1.0.0` → `2.0.0`)  
  Breaking changes

- **minor** (`1.3.0` → `1.4.0`)  
  New features

- **patch** (`1.3.2` → `1.3.3`)  
  Bug fixes and small improvements

## Commit message format

Contributors should use **Conventional Commits**:

```
feat: add user search endpoint
fix: correct null check in auth middleware
chore: update dependencies
```

CI will validate commit messages automatically.

## What contributors need to know

- You do **not** manually bump versions
- You do **not** manually edit the changelog
- You do **not** create tags

semantic‑release handles all of that automatically when changes are merged.

## What DevOps needs to know

- semantic‑release updates `package.json` and `CHANGELOG.md`
- semantic‑release does **not** create tags in this project
- Production releases are created manually by tagging a commit

This keeps development flexible while still producing consistent version numbers and release notes.
