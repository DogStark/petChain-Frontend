# Git workflow for this project

## Never use `git init`

This repository already exists on GitHub. Always clone it instead:

```bash
git clone https://github.com/fairbid01/petChain-Frontend.git
cd petChain-Frontend
```

## Creating a new feature branch

Always branch from the remote's latest main:

```bash
git fetch origin main
git checkout -b feature/your-branch-name origin/main
# ... make changes, commit ...
git push -u origin feature/your-branch-name
```

## If you accidentally started with `git init`

Do NOT force-push. Recover by rebasing onto the remote:

```bash
git fetch origin main
git checkout -b temp-rebased origin/main
# Copy your changes from the orphan branch:
git cherry-pick <your-commit-hash>
# Or manually copy changed files:
git checkout <orphan-branch> -- path/to/file1 path/to/file2
git commit -m "your message"
# Replace the broken branch:
git branch -D feature/your-branch
git branch -m feature/your-branch
git push -f -u origin feature/your-branch
```

## After cloning (one-time setup)

Run this to enable the shared pre-push hook:

```bash
git config core.hooksPath .githooks
```

This ensures the hook in `.githooks/pre-push` is used by everyone who clones the repo.

## Before pushing

The pre-push hook will reject pushes where your branch has no shared history with the remote. This prevents the "entirely different commit histories" error when opening a PR. If the hook blocks you, follow its instructions to rebase properly.

## Key rules

- **Never** force-push a branch that exists on remote unless you are replacing a broken history
- **Always** `git fetch origin` first to get the latest remote refs
- **Always** base new branches on `origin/main`, never on a local orphan commit
