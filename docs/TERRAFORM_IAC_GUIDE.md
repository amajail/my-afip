# Terraform Infrastructure as Code (IaC) Pipeline Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Initial Setup](#initial-setup)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Secrets Management](#secrets-management)
7. [Local Development](#local-development)
8. [Deployment Procedures](#deployment-procedures)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Overview

This IaC pipeline automates the deployment and management of your AFIP Invoice application infrastructure on Azure. The pipeline:

- ✅ Validates Terraform configurations
- ✅ Performs security scanning
- ✅ Plans infrastructure changes
- ✅ Applies changes to Azure
- ✅ Supports multiple environments (dev, staging, prod)
- ✅ Requires manual approval for production changes
- ✅ Maintains state in remote Azure Storage

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   GitHub Actions Workflow                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Validate & Format Check                                 │
│     ├─ terraform fmt -check                                 │
│     ├─ terraform validate                                   │
│     └─ tflint                                               │
│                                                               │
│  2. Security Scan                                           │
│     └─ tfsec (SARIF output)                                 │
│                                                               │
│  3. Environment-Specific Plans                              │
│     ├─ Dev Plan (automatic)                                 │
│     ├─ Staging Plan (manual approval)                       │
│     └─ Production Plan (manual trigger)                     │
│                                                               │
│  4. Apply Changes                                           │
│     ├─ Dev Apply (auto on merge)                            │
│     ├─ Staging Apply (requires approval)                    │
│     └─ Prod Apply (manual approval + trigger)               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Azure Resources                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  • Resource Group (one per environment)                     │
│  • Storage Account (Azure Tables + Blobs)                   │
│  • Key Vault (secrets management)                           │
│  • Application Insights (monitoring)                        │
│  • Azure Function App (compute)                             │
│  • Service Plan (consumption plan)                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│            Terraform State (Remote Backend)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Azure Storage Account                                      │
│  ├─ tfstate container                                       │
│  │  ├─ afip-invoice-dev.tfstate                            │
│  │  ├─ afip-invoice-staging.tfstate                        │
│  │  └─ afip-invoice-prod.tfstate                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Resources Deployed

| Resource | Type | Purpose | Dev | Staging | Prod |
|----------|------|---------|-----|---------|------|
| Resource Group | azurerm_resource_group | Container for resources | ✓ | ✓ | ✓ |
| Storage Account | azurerm_storage_account | Table & Blob storage | LRS | GRS | GRS |
| Storage Tables | azurerm_storage_table | Orders data | ✓ | ✓ | ✓ |
| Key Vault | azurerm_key_vault | Secrets management | ✓ | ✓ | ✓ |
| Application Insights | azurerm_application_insights | Monitoring & logging | ✓ | ✓ | ✓ |
| Function App | azurerm_linux_function_app | Serverless compute | ✓ | ✓ | ✓ |
| Service Plan | azurerm_service_plan | Function hosting (Y1) | ✓ | ✓ | ✓ |

---

## Prerequisites

### Required Tools

1. **Azure CLI** (version 2.40.0+)
   ```bash
   az --version
   ```

2. **Terraform** (version 1.5.0+)
   ```bash
   terraform --version
   ```

3. **Git** (for repository management)
   ```bash
   git --version
   ```

### Azure Account Requirements

1. **Active Azure Subscription** with appropriate permissions
2. **Service Principal** for CI/CD (with contributor role)
3. **Sufficient quota** in target region (eastus)

### Repository Setup

1. Repository admin access to configure secrets
2. Branch protection rules on `main` and `develop`
3. GitHub Actions enabled

---

## Initial Setup

### Step 1: Authenticate with Azure

```bash
# Login to Azure
az login

# Select correct subscription
az account set --subscription <SUBSCRIPTION_ID>

# Verify you're logged in
az account show
```

### Step 2: Create Terraform State Backend

Run the backend setup script for each environment:

```bash
# Make script executable
chmod +x scripts/terraform-backend-setup.sh

# Setup dev environment
./scripts/terraform-backend-setup.sh dev

# Setup staging environment
./scripts/terraform-backend-setup.sh staging

# Setup production environment
./scripts/terraform-backend-setup.sh prod
```

This script will:
- Create resource groups for state management
- Create storage accounts for remote state
- Create storage containers
- Generate `backend-{env}.tfbackend` files
- Display secrets to add to GitHub Actions

### Step 3: Configure GitHub Actions Secrets

Navigate to: **Settings → Secrets and variables → Actions**

Add the following secrets:

#### Azure Credentials
```
AZURE_CREDENTIALS (JSON from service principal)
AZURE_SUBSCRIPTION_ID
AZURE_CLIENT_ID
AZURE_CLIENT_SECRET
AZURE_TENANT_ID
```

#### Terraform State (Backend)
```
TF_STATE_RG_DEV
TF_STATE_STORAGE_DEV
TF_STATE_KEY_DEV

TF_STATE_RG_STAGING
TF_STATE_STORAGE_STAGING
TF_STATE_KEY_STAGING

TF_STATE_RG_PROD
TF_STATE_STORAGE_PROD
TF_STATE_KEY_PROD

TF_STATE_CONTAINER (shared: "tfstate")
```

#### Application Secrets
```
AFIP_CUIT (sensitive)
BINANCE_API_KEY (sensitive)
BINANCE_SECRET_KEY (sensitive)
```

### Step 4: Create Service Principal for CI/CD

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "terraform-cicd" \
  --role "Contributor" \
  --scopes "/subscriptions/{subscription-id}"

# Output will contain:
# - clientId → AZURE_CLIENT_ID
# - clientSecret → AZURE_CLIENT_SECRET
# - subscriptionId → AZURE_SUBSCRIPTION_ID
# - tenantId → AZURE_TENANT_ID

# For AZURE_CREDENTIALS, run:
az ad sp create-for-rbac \
  --name "terraform-cicd" \
  --role "Contributor" \
  --scopes "/subscriptions/{subscription-id}" \
  --json-auth
```

---

## CI/CD Pipeline

### Pipeline Stages

#### 1. **Validate & Format Check** (All PRs)
- Checks Terraform formatting
- Validates configuration syntax
- Runs linter (tflint)
- Fails if formatting issues found

#### 2. **Security Scan** (All PRs)
- Runs tfsec (Terraform security scanner)
- Checks for security misconfigurations
- Uploads results to GitHub Security
- Does not block pipeline (warning only)

#### 3. **Plan** (Environment-specific)

**Development (develop branch):**
- Automatic plan on PR
- Auto-applies on merge
- Instant feedback

**Staging (main branch):**
- Manual approval required before apply
- Allows validation of production-like environment

**Production (Manual trigger only):**
- Triggered via `workflow_dispatch`
- Requires manual approval
- Never auto-applies

#### 4. **Apply** (After approval)
- Creates/updates Azure resources
- Updates remote state
- Posts deployment summary to PR

### Trigger Events

| Event | Branch | Environment | Action |
|-------|--------|-------------|--------|
| Push | `develop` | Dev | Auto-plan, auto-apply |
| PR to `develop` | `develop` | Dev | Auto-plan, manual review |
| Push | `main` | Staging | Auto-plan, **requires approval** |
| PR to `main` | `main` | Staging | Auto-plan, manual review |
| Workflow Dispatch | `main` | Prod | Manual trigger required |
| Workflow Dispatch | `main` | Dev/Staging | Manual trigger for plan |

### Running Manual Deployments

1. Go to **Actions → Terraform Infrastructure Deployment**
2. Click **Run workflow**
3. Select environment and action:
   - `plan`: Preview changes
   - `apply`: Deploy changes
   - `destroy`: Remove infrastructure (⚠️  careful!)

---

## Secrets Management

### Sensitive Variables

These variables should NEVER be committed to the repository:

```
- afip_cuit: AFIP tax ID
- binance_api_key: Binance API credentials
- binance_secret_key: Binance secret credentials
```

### How Secrets Are Handled

1. **GitHub Actions Secrets** (input)
   - Store sensitive values securely
   - Passed as environment variables to Terraform
   - Masked in logs automatically

2. **Azure Key Vault** (storage)
   - Secrets stored securely in Key Vault
   - Function App retrieves via managed identity
   - No credentials in environment variables at runtime

### Adding New Secrets

1. **Add to GitHub Actions:**
   ```bash
   # Go to: Settings → Secrets and variables → Actions
   # Click: New repository secret
   # Name: <SECRET_NAME>
   # Value: <sensitive_value>
   ```

2. **Reference in Workflow:**
   ```yaml
   env:
     TF_VAR_my_secret: ${{ secrets.MY_SECRET }}
   ```

3. **Use in Terraform:**
   ```hcl
   variable "my_secret" {
     type      = string
     sensitive = true
   }

   # Secret is automatically stored in Key Vault by key_vault module
   ```

### Best Practices

✅ **DO:**
- Use GitHub Actions secrets for all sensitive values
- Mark variables as `sensitive = true` in Terraform
- Rotate API keys regularly
- Use least-privilege access (RBAC)
- Enable Key Vault soft delete

❌ **DON'T:**
- Commit `.tfvars` files with sensitive values
- Share credentials in chat/emails
- Use personal access tokens in long-lived workflows
- Store unencrypted secrets in state files

---

## Local Development

### Prerequisites

```bash
# Install Terraform
brew install terraform  # macOS
# or download from https://www.terraform.io/downloads.html

# Install Azure CLI
brew install azure-cli  # macOS
# or download from https://learn.microsoft.com/cli/azure

# Install tflint
brew install tflint
```

### Setup Local Environment

```bash
# Navigate to terraform directory
cd terraform

# Authenticate with Azure
az login
az account set --subscription <SUBSCRIPTION_ID>

# Initialize Terraform with dev backend
terraform init -backend-config=backend-dev.tfbackend

# Validate configuration
terraform validate

# Format check
terraform fmt -check -recursive

# Run linter
tflint

# View the plan (what will be created)
terraform plan -var-file="terraform.dev.tfvars"
```

### Local Development Workflow

```bash
# 1. Make changes to Terraform files
nano main.tf

# 2. Format code
terraform fmt -recursive

# 3. Validate syntax
terraform validate

# 4. Check formatting
terraform fmt -check -recursive

# 5. Run linter
tflint

# 6. Preview changes
terraform plan -var-file="terraform.dev.tfvars"

# 7. Apply changes (careful!)
terraform apply -var-file="terraform.dev.tfvars"

# 8. Check outputs
terraform output

# 9. Commit and push (to develop branch)
git add terraform/
git commit -m "feat: update infrastructure"
git push origin develop
```

### Switching Environments

```bash
# Switch to staging
terraform init -reconfigure -backend-config=backend-staging.tfbackend
terraform plan -var-file="terraform.staging.tfvars"

# Switch back to dev
terraform init -reconfigure -backend-config=backend-dev.tfbackend
terraform plan -var-file="terraform.dev.tfvars"
```

### Sensitive Values Locally

For local development, you can use environment variables:

```bash
export TF_VAR_afip_cuit="your-cuit-here"
export TF_VAR_binance_api_key="your-key-here"
export TF_VAR_binance_secret_key="your-secret-here"

# Then run:
terraform plan -var-file="terraform.dev.tfvars"
```

Or create a local `.tfvars.local` file (git-ignored):

```hcl
# terraform.dev.tfvars.local
afip_cuit            = "your-cuit"
binance_api_key      = "your-key"
binance_secret_key   = "your-secret"
```

---

## Deployment Procedures

### Development Deployment

**Automatic (on merge to develop):**

1. Push changes to develop branch
2. Open PR
3. Pipeline validates and plans
4. Approve PR
5. Merge to develop
6. **Pipeline automatically applies changes**

**Manual (via workflow dispatch):**

1. Go to Actions tab
2. Select "Terraform Infrastructure Deployment"
3. Click "Run workflow"
4. Select `environment: dev` and `action: plan` or `apply`

### Staging Deployment

**Via pull request to main:**

1. Create feature branch from `develop`
2. Make changes
3. Open PR to `main`
4. Pipeline plans automatically
5. Review plan carefully
6. Approve PR
7. **Merge triggers plan, requires environment approval for apply**

**Manual approval flow:**

1. PR → Plan stage (auto)
2. Review → GitHub environment approval
3. Apply stage (requires approval in GitHub)

### Production Deployment

⚠️ **PRODUCTION REQUIRES MANUAL TRIGGER AND APPROVAL**

**Step-by-step:**

1. Ensure all changes are in `main` branch
2. Go to **Actions → Terraform Infrastructure Deployment**
3. Click **Run workflow**
4. Select:
   - environment: `prod`
   - action: `plan`
5. Review plan output
6. Run workflow again with `action: apply`
7. Approval required in GitHub environment
8. **Monitor deployment in Actions tab**

**Pre-deployment checklist:**

- [ ] Code reviewed and merged to main
- [ ] Plan reviewed by team
- [ ] Backup of current state created
- [ ] Change window scheduled
- [ ] Rollback procedure prepared
- [ ] Monitoring alerts configured

---

## Troubleshooting

### Common Issues

#### 1. "Backend initialization failed"

```
Error: Failed to get existing workspaces: ...
```

**Solution:**
```bash
# Verify secrets are set correctly
# Check backend configuration
terraform init -backend-config=backend-dev.tfbackend -reconfigure

# Ensure storage account exists
az storage account show --name afiptfstatedev --resource-group afip-tfstate-rg-dev
```

#### 2. "Authentication failed"

```
Error: authenticating with Azure: ...
```

**Solution:**
```bash
# Re-authenticate with Azure
az login
az account set --subscription <SUBSCRIPTION_ID>

# Verify service principal
az ad sp show --id <CLIENT_ID>
```

#### 3. "Insufficient permissions"

```
Error: Authorization failed for resource ...
```

**Solution:**
- Check service principal has Contributor role
- Verify subscription ID matches
- Check Key Vault access policies

#### 4. "State lock timeout"

```
Error: Error acquiring the state lock: ...
```

**Solution:**
```bash
# Check for running deployments
# Force unlock if safe (use with caution)
terraform force-unlock <LOCK_ID>
```

#### 5. "Terraform plan shows unexpected changes"

**Solution:**
```bash
# Refresh state from Azure
terraform refresh -var-file="terraform.dev.tfvars"

# Check for drift
terraform plan -var-file="terraform.dev.tfvars" | grep -E "^[+-~]"

# Check current state
terraform show
```

### Debugging

Enable detailed logging:

```bash
# Verbose Terraform output
export TF_LOG=DEBUG
export TF_LOG_PATH=terraform.log
terraform plan -var-file="terraform.dev.tfvars"

# Azure CLI debugging
export DEBUG=True
az command-invoke

# Unset when done
unset TF_LOG TF_LOG_PATH DEBUG
```

### Getting Help

1. Check GitHub Actions logs
2. Review Terraform error messages
3. Check Azure portal for resource status
4. Review [`docs/migrations/terraform.md`](../migrations/terraform.md) for migration notes

---

## Best Practices

### Planning & Design

1. **Plan before apply:**
   ```bash
   terraform plan -var-file="terraform.dev.tfvars" -out=tfplan
   terraform show tfplan  # Review before applying
   ```

2. **Use consistent naming:**
   - Follow `{project}-{environment}-{resource-type}` pattern
   - Use local variables for consistency

3. **Keep modules focused:**
   - Single responsibility per module
   - Group related resources

### State Management

✅ **Always:**
- Use remote state (never local in CI/CD)
- Enable state locking
- Version state files
- Backup state before major changes

❌ **Never:**
- Manually edit state files
- Share state files via email
- Delete state without backup
- Commit state files to git

### Security

✅ **Always:**
- Mark sensitive variables with `sensitive = true`
- Use managed identities instead of credentials
- Enable Key Vault soft delete
- Enable storage account versioning
- Use TLS 1.2+
- Enable HTTPS only

❌ **Never:**
- Commit credentials to git
- Use personal access tokens
- Disable encryption
- Allow public access to storage

### Code Quality

✅ **Always:**
- Format code: `terraform fmt -recursive`
- Validate configuration: `terraform validate`
- Run linter: `tflint`
- Write descriptive comments
- Use consistent indentation (2 spaces)

❌ **Never:**
- Skip validation steps
- Hardcode values (use variables)
- Leave commented code
- Ignore linter warnings

### Change Management

✅ **Always:**
- Create feature branches
- Use descriptive commit messages
- Require PR reviews
- Test in dev first
- Document breaking changes
- Tag releases

❌ **Never:**
- Commit directly to main
- Make changes during production hours
- Skip code review
- Deploy without testing

### Monitoring & Maintenance

1. **Monitor deployments:**
   - Check GitHub Actions logs
   - Monitor Azure resources
   - Review Application Insights

2. **Regular maintenance:**
   - Review and rotate secrets monthly
   - Update Terraform version quarterly
   - Clean up unused resources
   - Review costs in Cost Management

3. **Keep documentation updated:**
   - Update this guide when procedures change
   - Document known issues
   - Share lessons learned

---

## References

- [Terraform Documentation](https://www.terraform.io/docs)
- [Azure Provider Documentation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Azure CLI Documentation](https://learn.microsoft.com/cli/azure)
- [tfsec Documentation](https://aquasecurity.github.io/tfsec)
- [tflint Documentation](https://github.com/terraform-linters/tflint)

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-15 | Initial IaC pipeline setup |

---

**Last Updated:** 2025-11-15  
**Maintained By:** Infrastructure Team  
**Status:** Active
