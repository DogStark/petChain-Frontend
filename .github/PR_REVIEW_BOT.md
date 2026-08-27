# PR Review Bot Documentation

## Overview
The PetChain project uses automated PR review bots to help maintainers manage the high volume of contributions efficiently.

## How It Works

### 1. Automated Review Bot
When you open a PR, the bot automatically:
- ✅ Runs linting checks
- ✅ Runs all tests
- ✅ Checks TypeScript types
- ✅ Attempts to build the project
- ✅ Runs security audits
- ✅ Posts a detailed review comment

### 2. Review Outcomes

**✅ APPROVED (All checks pass)**
- Your PR gets the `ready-for-review` label
- A maintainer will review your code
- If approved by maintainer, PR auto-merges

**❌ CHANGES REQUESTED (Some checks fail)**
- Your PR gets the `needs-work` label
- Fix the issues listed in the bot comment
- Push your changes
- Bot automatically re-reviews

### 3. Auto-Merge
PRs are automatically merged when:
- ✅ All automated checks pass
- ✅ At least 1 maintainer approval
- ✅ No requested changes
- ✅ Has `ready-for-review` label
- ✅ Not a draft PR

## For Contributors

### Before Opening a PR

**Frontend PRs:**
```bash
# Run these locally first
npm run lint
npm run type-check
npm run build
```

**Backend PRs:**
```bash
cd backend
npm run lint
npm run test
npm run build
```

### PR Checklist
- [ ] Code follows style guidelines
- [ ] All tests pass locally
- [ ] Added tests for new features
- [ ] Updated documentation
- [ ] No console.log or debug code
- [ ] Clear commit messages
- [ ] PR description explains changes

### Common Issues

**Linting Errors**
```bash
# Auto-fix most issues
npm run lint:fix
```

**Test Failures**
```bash
# Run tests locally
npm run test

# Run specific test
npm run test -- path/to/test.spec.ts
```

**Build Errors**
- Check TypeScript errors
- Ensure all imports are correct
- Verify environment variables

## For Maintainers

### Manual Review Required For:
- Breaking changes
- Security-sensitive code
- Database migrations
- API changes
- Architecture decisions

### Approving PRs
1. Review the automated checks
2. Review the code changes
3. Test locally if needed
4. Approve the PR
5. Bot auto-merges if all checks pass

### Requesting Changes
1. Leave specific comments on code
2. Use "Request Changes" review option
3. Contributor fixes issues
4. Bot re-reviews automatically

### Emergency Merge
If auto-merge fails:
```bash
# Merge manually
gh pr merge <PR_NUMBER> --squash
```

## Bot Configuration

### Customizing Review Rules

Edit `.github/workflows/pr-review-bot.yml`:

```yaml
# Change test coverage requirement
- name: Check coverage
  run: npm run test:cov -- --coverageThreshold=80

# Add custom checks
- name: Custom check
  run: npm run custom-script
```

### Disabling Auto-Merge

Add label `no-auto-merge` to PR to prevent automatic merging.

### Adjusting Approval Requirements

Edit `.github/workflows/auto-merge.yml`:

```javascript
// Require 2 approvals instead of 1
const hasApprovals = approvals.length >= 2;
```

## Labels Used by Bot

- `frontend` - Frontend changes
- `backend` - Backend changes
- `ready-for-review` - All checks passed
- `needs-work` - Issues found
- `auto-merge` - Approved for auto-merge
- `no-auto-merge` - Prevent auto-merge

## Troubleshooting

### Bot Not Commenting
- Check GitHub Actions permissions
- Verify workflow file syntax
- Check GitHub Actions logs

### Auto-Merge Not Working
- Ensure PR has required approvals
- Check all status checks passed
- Verify `ready-for-review` label exists
- Ensure PR is not draft

### False Positives
- Bot may flag issues that are acceptable
- Maintainer can override by approving
- Add `no-auto-merge` label if needed

## Security

The bot:
- ✅ Only runs on PRs (not direct pushes)
- ✅ Has limited permissions
- ✅ Cannot access secrets
- ✅ Logs all actions
- ✅ Requires maintainer approval for merge

## Support

Issues with the bot?
- Check [GitHub Actions logs](../../actions)
- Open an issue with `bot` label
- Contact [@llins_x](https://t.me/llins_x)

## Future Enhancements

Planned features:
- [ ] AI-powered code review suggestions
- [ ] Automatic dependency updates
- [ ] Performance regression detection
- [ ] Visual regression testing
- [ ] Automatic changelog generation