# GitHub Branch Protection Rules

This document describes the pull request policy for the my-afip repository.

## Overview

The PR policy enforces code quality by requiring:
- ✅ All builds must succeed
- ✅ All unit tests must pass
- ✅ Coverage thresholds must be met
- ✅ Security audits must pass

## GitHub Actions Workflow

The automated workflow is defined in `.github/workflows/pr-checks.yml` and runs on every PR and push to main/develop branches.

### Workflow Steps

1. **Checkout Code** - Fetch the repository
2. **Setup Node.js** - Tests run on Node 18.x and 20.x (LTS versions)
3. **Install Dependencies** - `npm ci` for clean installations
4. **Lint Check** - Optional linting (if available)
5. **Build Check** - Verify the project builds (`npm run build`)
6. **Unit Tests** - Run unit tests (`npm run test:unit`)
7. **Coverage Report** - Generate coverage reports (`npm run test:coverage`)
8. **Upload Coverage** - Upload to Codecov for tracking
9. **Security Audit** - Check for vulnerabilities

## Setting Up Branch Protection

To enforce this policy in GitHub:

### Step 1: Go to Repository Settings
1. Navigate to your repository on GitHub
2. Click **Settings** tab
3. Select **Branches** from the left sidebar
4. Click **Add branch protection rule**

### Step 2: Configure Protection Rule

**Branch name pattern:** `main`

Enable the following checks:

#### ✅ Require a pull request before merging
- [x] Require approvals (set to 1 or more)
- [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require review from Code Owners (if CODEOWNERS file exists)
- [x] Restrict who can push to matching branches (optional)

#### ✅ Require status checks to pass before merging
- [x] Require branches to be up to date before merging
- [x] Select the following status checks:
  - `build-and-test (16.x)`
  - `build-and-test (18.x)`
  - `build-and-test (20.x)`
  - `code-quality`

#### ✅ Additional Settings
- [x] Include administrators
- [x] Allow force pushes: No (disabled)
- [x] Allow deletions: No (disabled)

### Step 3: Create for develop branch

Repeat the process for the `develop` branch with similar settings (you may want slightly less strict requirements).

## Local Development

### Pre-commit Validation

Before pushing, run tests locally:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Check coverage
npm run test:coverage

# Build the project
npm run build --if-present
```

### Using Git Hooks (Optional)

Create a pre-push hook to prevent pushing failed tests:

```bash
# Create the hook
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
echo "Running tests before push..."
npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Push aborted."
  exit 1
fi
echo "✅ All tests passed. Proceeding with push."
EOF

# Make it executable
chmod +x .git/hooks/pre-push
```

## PR Checklist

When creating a PR, ensure:

- [ ] All unit tests pass: `npm run test:unit`
- [ ] Coverage meets thresholds: `npm run test:coverage`
- [ ] Code builds successfully: `npm run build --if-present`
- [ ] No security vulnerabilities: `npm audit --audit-level=moderate`
- [ ] Branch is up to date with main
- [ ] Descriptive PR title and description
- [ ] Linked to related issues

## Viewing Test Results

### In GitHub Actions
1. Go to your PR
2. Click **Checks** tab
3. View detailed logs for each job

### Coverage Reports
Coverage is uploaded to Codecov and can be viewed:
- On the PR (comment from Codecov bot)
- At `https://codecov.io/gh/amajail/my-afip`
- Locally in `coverage/index.html`

## Bypassing Checks (Not Recommended)

Only repository administrators can bypass these checks. If a check is genuinely broken, communicate with the team before merging without it.

## Continuous Improvement

This policy may be updated. Check back for changes:
- Review `CONTRIBUTING.md` (if exists)
- Check `.github/workflows/pr-checks.yml`
- Review GitHub branch protection settings

---

**Last Updated:** November 13, 2025
