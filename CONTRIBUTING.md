# Contribution Guidelines

## Before Submitting a Pull Request

### 1. Local Testing

```bash
npm install
npm test
npm run test:unit
npm run test:coverage
```

### 2. Requirements

- All tests must pass locally
- Coverage must meet the **57%** threshold (branches, functions, lines, statements)
- No new warnings or build errors

### 3. Code Quality

- Write clear, descriptive commit messages following Conventional Commits
- Keep commits atomic and logical
- Add tests for new features
- Update documentation if behavior changes

## Pull Request Process

### Branch Naming

- `feature/add-invoice-validation`
- `fix/correct-tax-calculation`
- `docs/update-readme`
- `refactor/extract-domain-service`

### PR Description Template

```markdown
## Description
Brief description of the changes and why.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Coverage threshold met (57%)

## Related Issues
Closes #123

## Checklist
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass locally
```

## Automated Checks

All PRs must pass (via GitHub Actions `pr-checks.yml`):

- **Unit Tests** — all tests pass on Node 18.x and 20.x
- **Coverage** — meets 57% threshold (branches, functions, lines, statements)
- **Security Audit** — `npm audit --audit-level=moderate`

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add invoice date validation
fix: correct AFIP tax code calculation
docs: update architecture documentation
test: add unit tests for Money value object
refactor: extract OrderProcessor domain service
chore: update dependencies
```

## Branch Protection

Direct pushes to `main` require admin bypass. All changes should go through a pull request.

---

**Last Updated:** April 2026
