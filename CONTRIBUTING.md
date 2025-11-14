# Contribution Guidelines

## Before Submitting a Pull Request

### 1. Local Testing
Always test your changes locally before pushing:

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run unit tests specifically
npm run test:unit

# Generate coverage report
npm run test:coverage

# Build the project
npm run build --if-present
```

### 2. Ensure Tests Pass
- All tests must pass locally before pushing
- Coverage must meet the threshold (80% for branches, functions, lines, and statements)
- No warnings or errors in the build

### 3. Code Quality
- Write clear, descriptive commit messages
- Keep commits atomic and logical
- Update documentation if needed
- Add tests for new features

## Pull Request Process

### Creating a PR

1. **Branch naming:** Use descriptive names
   - `feature/add-invoice-validation`
   - `fix/correct-tax-calculation`
   - `docs/update-readme`

2. **PR Title:** Clear and concise
   - ✅ "Fix: Correct AFIP tax code calculation"
   - ❌ "Fixed stuff"

3. **PR Description:** Include
   - What changes were made and why
   - Links to related issues
   - Screenshots (if applicable)
   - Testing instructions

### Example PR Template

```markdown
## Description
Brief description of the changes.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Coverage threshold met (80%)

## Related Issues
Closes #123

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
```

## Automated Checks

All PRs must pass:

- ✅ **Build Check** - Project must compile/build successfully
- ✅ **Unit Tests** - All unit tests must pass
- ✅ **Coverage** - Must meet 80% threshold
- ✅ **Security Audit** - No high/critical vulnerabilities
- ✅ **Multiple Node versions** - Tests pass on Node 16.x, 18.x, 20.x

These are automatically run by GitHub Actions on every PR.

## After Merging

- Branch protection prevents direct pushes to main
- All automated checks must pass
- Requires at least one approval (if configured)
- After merge, branch can be safely deleted

## Questions or Issues?

If a check fails or you have questions:
1. Review the GitHub Actions logs
2. Check the PULL_REQUEST_POLICY.md file
3. Consult the team or project maintainers

---

**Last Updated:** November 13, 2025
