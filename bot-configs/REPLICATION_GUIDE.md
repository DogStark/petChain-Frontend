# Bot Replication Guide

## 1. Architecture Overview

PetChain uses two GitHub Actions bots for automated PR management:

### PR Review Bot (`.github/workflows/pr-review-bot.yml`)
- **Trigger:** `pull_request` events (`opened`, `synchronize`, `reopened`) targeting `main` or `develop`
- **Permissions:** `contents: read`, `pull-requests: write`, `issues: write`
- **What it does:**
  1. Detects whether the PR touches `backend/` or `src/` (frontend)
  2. Runs the appropriate checks (lint, type-check, build, tests)
  3. Posts a structured review comment summarising pass/fail per check
  4. Applies labels: the area label (`frontend` or `backend`) plus either `ready-for-review` (all checks passed) or `needs-work` (one or more failed)

### Auto-Merge Bot (`.github/workflows/auto-merge.yml`)
- **Trigger:** `pull_request_review` (submitted) and `check_suite` (completed)
- **Permissions:** `contents: write`, `pull-requests: write`
- **What it does:**
  1. Reads the PR's review list, check-run results, labels, and draft status
  2. Merges via squash when **all** of the following are true:
     - ≥ 1 approval
     - No `CHANGES_REQUESTED` reviews
     - All check runs passed or were skipped
     - PR is not a draft
     - PR carries the `ready-for-review` label
  3. Deletes the head branch after a successful merge (unless it is `main` or `develop`)
  4. Posts a comment if auto-merge fails, so maintainers can merge manually

### Interaction between the two bots
The review bot is the gatekeeper: it only applies `ready-for-review` when checks pass. The auto-merge bot depends on that label, so it will never merge a PR that the review bot has flagged as `needs-work`.

---

## 2. Replicating the Setup in a Fork

1. **Fork the repository** on GitHub.
2. **Enable GitHub Actions** in your fork:
   `Settings → Actions → General → Allow all actions and reusable workflows`
3. **Verify `GITHUB_TOKEN` permissions** (these are the defaults for public forks, but confirm under `Settings → Actions → General → Workflow permissions`):
   - `contents: write`
   - `pull-requests: write`
   - `issues: write`
4. **No additional secrets are required.** Both bots use only `GITHUB_TOKEN`.
5. **Create the required labels** (see Section 3) before opening any PRs.
6. **Push a branch and open a PR** against `main` or `develop` to verify the review bot triggers and posts a comment.

---

## 3. Required Labels

These labels must exist in the repository before the bots run. Create them with the `gh` CLI:

```bash
gh label create frontend        --color 0075ca --repo OWNER/REPO
gh label create backend         --color e4e669 --repo OWNER/REPO
gh label create ready-for-review --color 0e8a16 --repo OWNER/REPO
gh label create needs-work      --color d93f0b --repo OWNER/REPO
gh label create auto-merge      --color 1d76db --repo OWNER/REPO
gh label create no-auto-merge   --color b60205 --repo OWNER/REPO
```

| Label | Created by | Purpose |
|---|---|---|
| `frontend` | PR Review Bot | Marks PR as touching frontend code |
| `backend` | PR Review Bot | Marks PR as touching backend code |
| `ready-for-review` | PR Review Bot | All automated checks passed |
| `needs-work` | PR Review Bot | One or more checks failed |
| `auto-merge` | Auto-Merge Bot | PR is being auto-merged |
| `no-auto-merge` | Maintainer | Prevents auto-merge |

---

## 4. Customising the Review Bot

**Changing which branches trigger the bot** (`.github/workflows/pr-review-bot.yml`):

```yaml
on:
  pull_request:
    branches: [main, develop, staging]  # add branches here
```

**Requiring stricter test coverage:**

```yaml
- name: Backend - Run tests with coverage
  run: npm run test:cov -- --coverageThreshold=80
```

**Adding a custom check:**

```yaml
- name: Custom check
  id: custom-check
  continue-on-error: true
  run: npm run your-script
```

Then reference the outcome in the `Generate Review Comment` step:

```javascript
if ('${{ steps.custom-check.outcome }}' === 'failure') {
  approvalStatus = false;
  issues.push('❌ **Custom check failed**');
}
```

---

## 5. Customising Auto-Merge

**Requiring 2 approvals instead of 1** (`.github/workflows/auto-merge.yml`):

```javascript
const hasApprovals = approvals.length >= 2;
```

**Preventing auto-merge on a specific PR:**
Add the `no-auto-merge` label to the PR. Alternatively, removing the `ready-for-review` label also prevents the auto-merge bot from triggering.

**Changing merge strategy** (squash → merge commit or rebase):

```javascript
merge_method: 'merge'   // or 'rebase'
```

---

## 6. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Bot not commenting on PR | Actions permissions not enabled | `Settings → Actions → Allow all actions` |
| Labels not being applied | Labels don't exist in repo | Run the `gh label create` commands in Section 3 |
| Auto-merge not triggering | `ready-for-review` label missing | Ensure review bot ran and all checks passed |
| Auto-merge fails with 405 | Branch protection requires more approvals | Adjust protection rules or increase approval count in the workflow |
| Bot re-reviews on every push | Expected behaviour on `synchronize` event | No action needed |

---

## 7. Security Considerations

- Both bots use only `GITHUB_TOKEN` — no personal access tokens or external secrets are needed.
- The review bot has `contents: read` only; it cannot push code.
- The auto-merge bot has `contents: write` scoped to merging and branch deletion only.
- Neither bot can access repository secrets.
- All bot actions are logged in the **Actions** tab of the repository.

---

## 8. Emergency Manual Merge

If auto-merge fails or is blocked:

```bash
gh pr merge <PR_NUMBER> --squash --repo DogStark/petChain-Frontend
```
