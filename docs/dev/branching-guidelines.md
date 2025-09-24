# Branching and Pull Request Guidelines

## Branch Naming Convention

All branches must follow one of the enforced prefixes:

- `feat/<short-description>` for new features.
- `fix/<short-description>` for bug fixes or regressions.
- `chore/<short-description>` for maintenance work, refactors, or tooling updates.

Choose concise, kebab-case descriptions to clarify the purpose of the branch.

## Pull Request Requirements

- **No direct commits** to the default branch (`main`). Every change must be merged through a pull request (PR).
- Ensure your branch is up to date with the latest `main` before opening a PR.
- Provide a clear description of the change set, referencing relevant issues or tickets where applicable.

## Reviewer Checklist

Reviewers should confirm the following before approving a PR:

- ✅ Continuous Integration (CI) checks pass.
- ✅ Documentation is updated when behavior or processes change.
- ✅ Tests are added or updated when the change requires them.
