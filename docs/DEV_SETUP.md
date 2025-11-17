# Dev Environment Setup (quick focused guide)

This file explains how to set up the DEV environment only — quick, minimal steps so you can get started.

Important: the steps below require the Azure CLI and an Azure subscription. If you prefer, run `scripts/terraform-backend-setup.sh dev` (it automates the storage creation). See the main docs for alternatives.

## 1) Create backend resources for Terraform state (one-time)

Option A (recommended): run the provided helper script (requires az login):

```bash
# Make script executable (only once)
chmod +x scripts/terraform-backend-setup.sh

# Run for dev
./scripts/terraform-backend-setup.sh dev
```

The script will create:
- Resource group: `afip-tfstate-rg-dev`
- Storage account: `afiptfstatedev`
- Container: `tfstate`

It will also generate `terraform/backend-dev.tfbackend` in the repo and print the backend values you should add as GitHub Actions secrets (if you want CI to use this backend).

Option B (manual az CLI):

```bash
# variables
RG=afip-tfstate-rg-dev
LOCATION=eastus
STORAGE=afiptfstatedev
CONTAINER=tfstate

# create resource group
az group create --name "$RG" --location "$LOCATION"

# create storage account
az storage account create \
  --name "$STORAGE" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --https-only true --min-tls-version TLS1_2

# get storage key
STORAGE_KEY=$(az storage account keys list --resource-group "$RG" --account-name "$STORAGE" --query '[0].value' -o tsv)

# create container
az storage container create --name "$CONTAINER" --account-name "$STORAGE" --account-key "$STORAGE_KEY"
```

After running either option, keep the following values for GitHub Actions or local backend file:
- TF_STATE_RG_DEV = afip-tfstate-rg-dev
- TF_STATE_STORAGE_DEV = afiptfstatedev
- TF_STATE_KEY_DEV = afip-invoice-dev.tfstate
- TF_STATE_CONTAINER = tfstate

> Note: if you are not ready to store remote state in Azure, you can use local state while testing, but don't use that for CI.

## 2) Prepare sensitive values for local testing (do not commit)

Copy the example file and add secrets locally:

```bash
cp terraform/terraform.dev.local.tfvars.example terraform/terraform.dev.local.tfvars
# Edit terraform/terraform.dev.local.tfvars and fill the sensitive values
```

Or export them as environment variables (preferred for local testing):

```bash
export TF_VAR_afip_cuit="<AFIP_CUIT>"
export TF_VAR_binance_api_key="<BINANCE_API_KEY>"
export TF_VAR_binance_secret_key="<BINANCE_SECRET_KEY>"
```

## 3) (Optional) Create a service principal for CI to authenticate

If you want GitHub Actions to run Terraform against Azure for dev, create a service principal and add secrets to the repository (see `docs/SECRETS_SETUP_GUIDE.md`).

Quick command (run locally):

```bash
az ad sp create-for-rbac \
  --name "terraform-cicd-dev" \
  --role "Contributor" \
  --scopes "/subscriptions/<SUBSCRIPTION_ID>" \
  --sdk-auth
```

Save the JSON output as the `AZURE_CREDENTIALS` GitHub Actions secret and populate `AZURE_SUBSCRIPTION_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `AZURE_TENANT_ID` as required.

## 4) Initialize Terraform for DEV (local)

If you created the backend via the helper script, there is a `terraform/backend-dev.tfbackend` file in the repo. Initialize Terraform using it:

```bash
cd terraform
terraform init -backend-config=backend-dev.tfbackend
```

If you created the backend manually, either point `terraform init` to your own `-backend-config` file or use CLI flags:

```bash
terraform init \
  -backend-config="resource_group_name=afip-tfstate-rg-dev" \
  -backend-config="storage_account_name=afiptfstatedev" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=afip-invoice-dev.tfstate"
```

## 5) Plan & Apply (local)

```bash
# plan (uses terraform.dev.tfvars for non-sensitive values + local secrets via env / terraform.dev.local.tfvars)
terraform plan -var-file="terraform.dev.tfvars"

# apply
terraform apply -var-file="terraform.dev.tfvars"
```

Notes:
- To pass sensitive values from environment to Terraform, prefix with `TF_VAR_`, e.g. `TF_VAR_afip_cuit`.
- When running in GitHub Actions, the workflow will supply `TF_VAR_*` values from secrets.

## 6) Plan & Apply (via GitHub Actions)

The repository includes `.github/workflows/terraform-deploy.yml`. To run the dev plan/apply via Actions manually:

1. Go to GitHub → Actions → Terraform Infrastructure Deployment
2. Click "Run workflow"
3. Choose `environment: dev` and `action: plan` (or `apply`) and run

Before using the workflow, add these repo secrets (dev):
- `AZURE_CREDENTIALS` (if using CI to authenticate)
- `AZURE_SUBSCRIPTION_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
- `TF_STATE_RG_DEV`, `TF_STATE_STORAGE_DEV`, `TF_STATE_KEY_DEV`, `TF_STATE_CONTAINER`
- `AFIP_CUIT`, `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`

## 7) What I can do next for you

- If you want, I can:
  - Create the storage account and container in your Azure subscription (requires `az` credentials here), or
  - Provide the exact `az` commands with substitutions for your subscription ID and preferred names, or
  - Help generate the GitHub Actions secrets JSON payload for `AZURE_CREDENTIALS` once you create a service principal.

If you want me to run any `az` commands from this environment, I will need your consent and a secure way to provide credentials—otherwise follow the commands above locally.
