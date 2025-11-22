# Terraform IaC Pipeline - Quick Reference

## 🚀 Quick Start Commands

### Initial Setup (One-time)

```bash
# 1. Create backend for each environment
chmod +x scripts/terraform-backend-setup.sh
./scripts/terraform-backend-setup.sh dev
./scripts/terraform-backend-setup.sh staging
./scripts/terraform-backend-setup.sh prod

# 2. Add GitHub Actions secrets (see output of above script)
# Go to: https://github.com/amajail/my-afip/settings/secrets/actions

# 3. Test local connection
cd terraform
terraform init -backend-config=backend-dev.tfbackend
terraform validate
```

### Local Development Workflow

```bash
# Navigate to terraform directory
cd terraform

# Switch to dev environment
terraform init -reconfigure -backend-config=backend-dev.tfbackend

# Validate and format
terraform validate
terraform fmt -recursive

# Plan changes
terraform plan -var-file="terraform.dev.tfvars" -out=tfplan

# Review plan
terraform show tfplan

# Apply (if changes look good)
terraform apply tfplan

# Check outputs
terraform output
```

### Code Quality Checks

```bash
cd terraform

# Format code (auto-fix)
terraform fmt -recursive

# Format check
terraform fmt -check -recursive

# Validate syntax
terraform validate

# Run linter
tflint
tflint --init  # First time setup
```

### Switching Environments

```bash
cd terraform

# Switch to staging
terraform init -reconfigure -backend-config=backend-staging.tfbackend

# Switch to production
terraform init -reconfigure -backend-config=backend-prod.tfbackend

# Switch back to dev
terraform init -reconfigure -backend-config=backend-dev.tfbackend
```

### Viewing State and Resources

```bash
# List all resources in state
terraform state list

# Show specific resource
terraform state show 'azurerm_resource_group.main'

# View outputs
terraform output

# View specific output
terraform output resource_group_name
```

## 📊 Pipeline Triggers

| Branch | Event | Environment | Auto-Apply |
|--------|-------|-------------|-----------|
| `develop` | Push | Dev | ✅ Yes |
| `develop` | PR | Dev | ❌ Requires approval |
| `main` | Push | Staging | ❌ Requires approval |
| `main` | PR | Staging | ❌ Manual review |
| `main` | Workflow Dispatch | Prod | ❌ Manual trigger |

## 🔐 Required GitHub Actions Secrets

### Authentication (Required)
```
AZURE_CREDENTIALS         (JSON from service principal)
AZURE_SUBSCRIPTION_ID     (Subscription ID)
AZURE_CLIENT_ID           (Service principal ID)
AZURE_CLIENT_SECRET       (Service principal secret)
AZURE_TENANT_ID           (Azure tenant ID)
```

### Backend State (Required)
```
TF_STATE_RG_DEV           (afip-tfstate-rg-dev)
TF_STATE_STORAGE_DEV      (afiptfstatedev)
TF_STATE_KEY_DEV          (afip-invoice-dev.tfstate)

TF_STATE_RG_STAGING       (afip-tfstate-rg-staging)
TF_STATE_STORAGE_STAGING  (afiptfstatestaging)
TF_STATE_KEY_STAGING      (afip-invoice-staging.tfstate)

TF_STATE_RG_PROD          (afip-tfstate-rg-prod)
TF_STATE_STORAGE_PROD     (afiptfstateprod)
TF_STATE_KEY_PROD         (afip-invoice-prod.tfstate)

TF_STATE_CONTAINER        (tfstate) - shared by all
```

### Application Secrets (Required)
```
AFIP_CUIT                 (Your AFIP tax ID)
BINANCE_API_KEY           (Binance API key)
BINANCE_SECRET_KEY        (Binance secret key)
```

## 📋 Deployment Checklist

### Development (Auto)
- [x] Automatic on merge to `develop`
- [x] Plan shown in PR
- [x] Auto-applies changes
- [ ] Monitor in Actions tab

### Staging (Semi-auto)
- [ ] PR to `main` opens plan
- [ ] Review plan carefully
- [ ] Merge PR
- [ ] Requires environment approval
- [ ] Monitor deployment

### Production (Manual)
- [ ] Changes merged to `main`
- [ ] Review requirements with team
- [ ] Go to Actions → Terraform Deployment
- [ ] Run workflow → environment: prod, action: plan
- [ ] Review plan (CAREFULLY!)
- [ ] Run workflow → environment: prod, action: apply
- [ ] Approve in GitHub environment
- [ ] Monitor deployment (Critical!)

## 🛑 Emergency Procedures

### View Current State
```bash
cd terraform
terraform init -reconfigure -backend-config=backend-{ENV}.tfbackend
terraform state list
terraform state show 'resource_name'
```

### Destroy Infrastructure (CAREFUL!)
```bash
cd terraform
terraform init -reconfigure -backend-config=backend-{ENV}.tfbackend
terraform plan -destroy -var-file="terraform.{ENV}.tfvars"
terraform destroy -var-file="terraform.{ENV}.tfvars"

# Or via Actions (if available)
# Actions → Run workflow → environment: prod, action: destroy
```

### Force Unlock State (If locked)
```bash
cd terraform
terraform force-unlock <LOCK_ID>
```

### Refresh State From Azure
```bash
cd terraform
terraform refresh -var-file="terraform.dev.tfvars"
```

## 🔍 Debugging Commands

```bash
# Enable debug logging
export TF_LOG=DEBUG
export TF_LOG_PATH=terraform.log

# Run command
terraform plan -var-file="terraform.dev.tfvars"

# View logs
cat terraform.log

# Disable logging
unset TF_LOG TF_LOG_PATH

# Check Azure resources
az resource list --query "[].{name:name, type:type}" -o table

# Check resource group
az group show --name afip-invoice-dev-rg

# Check storage account
az storage account show --name afiptfstatedev --resource-group afip-tfstate-rg-dev

# Check function app
az functionapp list --resource-group afip-invoice-dev-rg
```

## 📁 File Structure

```
terraform/
├── main.tf                          # Main infrastructure definition
├── variables.tf                     # Variable definitions
├── outputs.tf                       # Output definitions
├── backend.tf                       # Backend configuration
├── terraform.dev.tfvars             # Dev environment variables
├── terraform.staging.tfvars         # Staging environment variables
├── terraform.prod.tfvars            # Prod environment variables
├── backend-dev.tfbackend            # Dev backend config (generated)
├── backend-staging.tfbackend        # Staging backend config (generated)
├── backend-prod.tfbackend           # Prod backend config (generated)
├── .terraformignore                 # Files to ignore
└── modules/
    ├── storage/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── key_vault/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── app_insights/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── function_app/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf

.github/
└── workflows/
    ├── pr-checks.yml                # PR validation
    └── terraform-deploy.yml         # IaC pipeline

docs/
└── TERRAFORM_IAC_GUIDE.md          # Full documentation

scripts/
└── terraform-backend-setup.sh      # Backend setup script
```

## 🔗 Useful Links

- **Repository:** https://github.com/amajail/my-afip
- **GitHub Actions:** https://github.com/amajail/my-afip/actions
- **Secrets:** https://github.com/amajail/my-afip/settings/secrets/actions
- **Environments:** https://github.com/amajail/my-afip/settings/environments
- **Azure Portal:** https://portal.azure.com
- **Terraform Docs:** https://www.terraform.io/docs
- **Azure Provider:** https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs

## 💡 Tips & Tricks

### Create a Terraform alias
```bash
# Add to ~/.bashrc or ~/.zshrc
alias tf='terraform'
alias tfp='terraform plan'
alias tfa='terraform apply'
alias tfv='terraform validate'
alias tfmt='terraform fmt -recursive'
```

### Before major changes
```bash
# Create a backup
terraform state pull > terraform.tfstate.backup.json

# Create a plan file
terraform plan -var-file="terraform.dev.tfvars" -out=tfplan.backup

# Review plan thoroughly
terraform show tfplan.backup > plan_review.txt
```

### Monitor Azure resources
```bash
# Watch resource group
az group show --name afip-invoice-dev-rg --query properties

# List resources
az resource list --resource-group afip-invoice-dev-rg --output table

# Check costs
az costmanagement query --timeframe MonthToDate --type Usage
```

## ⚠️ Common Mistakes

❌ **DON'T:**
- `terraform apply` without reviewing plan first
- Commit sensitive values to git
- Manually edit resources in Azure Portal
- Delete state files
- Use `--auto-approve` in production
- Share credentials via chat

✅ **DO:**
- Review `terraform plan` output before applying
- Use GitHub Actions secrets for sensitive values
- Keep Terraform as single source of truth
- Backup state before major changes
- Require code review for infrastructure changes
- Use consistent naming conventions

## 📞 Support

For issues or questions:
1. Check [`TERRAFORM_IAC_GUIDE.md`](TERRAFORM_IAC_GUIDE.md) Troubleshooting section
2. Review GitHub Actions logs
3. Check Azure Portal resource status
4. Contact infrastructure team

---

**Version:** 1.0.0  
**Last Updated:** 2025-11-15  
**Status:** Active
