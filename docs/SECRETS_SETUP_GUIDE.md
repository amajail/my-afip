# GitHub Actions & Azure Secrets Setup Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Create Service Principal](#create-service-principal)
3. [GitHub Actions Secrets](#github-actions-secrets)
4. [Azure Key Vault Integration](#azure-key-vault-integration)
5. [Secret Rotation](#secret-rotation)
6. [Troubleshooting](#troubleshooting)

---

## Overview

This guide walks through setting up all required secrets for the Terraform IaC pipeline. Secrets are stored in two places:

1. **GitHub Actions** - CI/CD credentials and backend configuration
2. **Azure Key Vault** - Application secrets accessed by Function App

### Secret Types

| Type | Location | Purpose | Rotation |
|------|----------|---------|----------|
| Azure Credentials | GitHub Actions | CI/CD authentication | Quarterly |
| AFIP CUIT | Both | Tax ID for AFIP API | Annual |
| Binance API Key | Both | Binance trading API | Quarterly |
| Storage Keys | Azure | Table/Blob storage access | Annually |

---

## Create Service Principal

### Step 1: Create Service Principal for CI/CD

A service principal is an Azure identity for your CI/CD pipeline.

```bash
# Set your subscription ID
SUBSCRIPTION_ID="00000000-0000-0000-0000-000000000000"  # Replace with your ID
SERVICE_PRINCIPAL_NAME="terraform-cicd"

# Create the service principal with Contributor role
az ad sp create-for-rbac \
  --name "$SERVICE_PRINCIPAL_NAME" \
  --role "Contributor" \
  --scopes "/subscriptions/$SUBSCRIPTION_ID"
```

**Output:**
```json
{
  "appId": "00000000-0000-0000-0000-111111111111",
  "displayName": "terraform-cicd",
  "password": "xxxxxxxxxxxxx~xxxxxxxxxxxxx",
  "tenant": "00000000-0000-0000-0000-222222222222"
}
```

**Save these values:**
- `appId` → `AZURE_CLIENT_ID`
- `password` → `AZURE_CLIENT_SECRET`
- `tenant` → `AZURE_TENANT_ID`
- Your subscription → `AZURE_SUBSCRIPTION_ID`

### Step 2: Get Full Credentials JSON (for AZURE_CREDENTIALS secret)

```bash
az ad sp create-for-rbac \
  --name "terraform-cicd" \
  --role "Contributor" \
  --scopes "/subscriptions/$SUBSCRIPTION_ID" \
  --json-auth
```

**Output:**
```json
{
  "clientId": "00000000-0000-0000-0000-111111111111",
  "clientSecret": "xxxxxxxxxxxxx~xxxxxxxxxxxxx",
  "subscriptionId": "00000000-0000-0000-0000-000000000000",
  "tenantId": "00000000-0000-0000-0000-222222222222",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.microsoft.com/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

**Copy the entire JSON for `AZURE_CREDENTIALS` secret.**

### Step 3: Verify Service Principal

```bash
# List service principals
az ad sp list --filter "displayName eq 'terraform-cicd'" --output table

# Check role assignment
az role assignment list \
  --assignee "terraform-cicd" \
  --scope "/subscriptions/$SUBSCRIPTION_ID"
```

---

## GitHub Actions Secrets

### Access Repository Secrets

1. Go to: **https://github.com/amajail/my-afip**
2. Click **Settings**
3. Select **Secrets and variables** → **Actions**
4. Click **New repository secret**

### Add All Required Secrets

#### A. Azure Authentication (Required)

**1. AZURE_CREDENTIALS**
```
Name: AZURE_CREDENTIALS
Value: [Paste entire JSON from Step 2 above]
```

**2. AZURE_SUBSCRIPTION_ID**
```
Name: AZURE_SUBSCRIPTION_ID
Value: 00000000-0000-0000-0000-000000000000
```

**3. AZURE_CLIENT_ID**
```
Name: AZURE_CLIENT_ID
Value: 00000000-0000-0000-0000-111111111111
```

**4. AZURE_CLIENT_SECRET**
```
Name: AZURE_CLIENT_SECRET
Value: xxxxxxxxxxxxx~xxxxxxxxxxxxx
```

**5. AZURE_TENANT_ID**
```
Name: AZURE_TENANT_ID
Value: 00000000-0000-0000-0000-222222222222
```

#### B. Terraform Backend - Development (From terraform-backend-setup.sh output)

**6. TF_STATE_RG_DEV**
```
Name: TF_STATE_RG_DEV
Value: afip-tfstate-rg-dev
```

**7. TF_STATE_STORAGE_DEV**
```
Name: TF_STATE_STORAGE_DEV
Value: afiptfstatedev
```

**8. TF_STATE_KEY_DEV**
```
Name: TF_STATE_KEY_DEV
Value: afip-invoice-dev.tfstate
```

#### C. Terraform Backend - Staging

**9. TF_STATE_RG_STAGING**
```
Name: TF_STATE_RG_STAGING
Value: afip-tfstate-rg-staging
```

**10. TF_STATE_STORAGE_STAGING**
```
Name: TF_STATE_STORAGE_STAGING
Value: afiptfstatestaging
```

**11. TF_STATE_KEY_STAGING**
```
Name: TF_STATE_KEY_STAGING
Value: afip-invoice-staging.tfstate
```

#### D. Terraform Backend - Production

**12. TF_STATE_RG_PROD**
```
Name: TF_STATE_RG_PROD
Value: afip-tfstate-rg-prod
```

**13. TF_STATE_STORAGE_PROD**
```
Name: TF_STATE_STORAGE_PROD
Value: afiptfstateprod
```

**14. TF_STATE_KEY_PROD**
```
Name: TF_STATE_KEY_PROD
Value: afip-invoice-prod.tfstate
```

#### E. Terraform Backend - Shared

**15. TF_STATE_CONTAINER**
```
Name: TF_STATE_CONTAINER
Value: tfstate
```

#### F. Application Secrets ⚠️ SENSITIVE

**16. AFIP_CUIT** ⚠️
```
Name: AFIP_CUIT
Value: [Your 11-digit CUIT without hyphens]
Note: SENSITIVE - Mask in logs is automatic
```

**17. BINANCE_API_KEY** ⚠️
```
Name: BINANCE_API_KEY
Value: [Your Binance API key]
Note: SENSITIVE - Mask in logs is automatic
```

**18. BINANCE_SECRET_KEY** ⚠️
```
Name: BINANCE_SECRET_KEY
Value: [Your Binance secret key]
Note: SENSITIVE - Mask in logs is automatic
```

### Verification Checklist

- [ ] AZURE_CREDENTIALS
- [ ] AZURE_SUBSCRIPTION_ID
- [ ] AZURE_CLIENT_ID
- [ ] AZURE_CLIENT_SECRET
- [ ] AZURE_TENANT_ID
- [ ] TF_STATE_RG_DEV
- [ ] TF_STATE_STORAGE_DEV
- [ ] TF_STATE_KEY_DEV
- [ ] TF_STATE_RG_STAGING
- [ ] TF_STATE_STORAGE_STAGING
- [ ] TF_STATE_KEY_STAGING
- [ ] TF_STATE_RG_PROD
- [ ] TF_STATE_STORAGE_PROD
- [ ] TF_STATE_KEY_PROD
- [ ] TF_STATE_CONTAINER
- [ ] AFIP_CUIT
- [ ] BINANCE_API_KEY
- [ ] BINANCE_SECRET_KEY

**Total: 18 secrets**

---

## Azure Key Vault Integration

### How It Works

1. Terraform creates Azure Key Vault
2. GitHub Actions secrets → passed to Terraform
3. Terraform stores secrets in Key Vault
4. Function App retrieves secrets via managed identity
5. No credentials in environment at runtime

### Key Vault Access

The Azure Function App has a system-assigned managed identity that allows it to read secrets from Key Vault without storing credentials.

### Accessing Secrets from Function App

In your function code:

```javascript
// Using Azure SDK
const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");

const credential = new DefaultAzureCredential();
const client = new SecretClient(
  `https://{vault-name}.vault.azure.net/`,
  credential
);

// Retrieve secret
const secret = await client.getSecret("AFIP_CUIT");
console.log(`AFIP_CUIT: ${secret.value}`);
```

Or via Key Vault references in app settings:

```
@Microsoft.KeyVault(SecretUri=https://vault-name.vault.azure.net/secrets/AFIP_CUIT/)
```

### Viewing Secrets in Key Vault

```bash
# List secrets in Key Vault
az keyvault secret list \
  --vault-name "afip-invoice-dev-kv" \
  --query "[].name" -o table

# Get a specific secret
az keyvault secret show \
  --vault-name "afip-invoice-dev-kv" \
  --name "AFIP_CUIT"

# Show secret value (careful!)
az keyvault secret show \
  --vault-name "afip-invoice-dev-kv" \
  --name "AFIP_CUIT" \
  --query value -o tsv
```

---

## Secret Rotation

### Rotation Schedule

| Secret | Frequency | Procedure |
|--------|-----------|-----------|
| Azure Service Principal | Quarterly | Create new, update GitHub secrets |
| AFIP CUIT | Annual | Update in GitHub & Key Vault |
| Binance API Key | Quarterly | Rotate on Binance, update secrets |
| Storage Account Keys | Annually | Regenerate in Azure, update Function App |

### Rotate Azure Credentials

```bash
# Create new service principal
SUBSCRIPTION_ID="00000000-0000-0000-0000-000000000000"
az ad sp create-for-rbac \
  --name "terraform-cicd" \
  --role "Contributor" \
  --scopes "/subscriptions/$SUBSCRIPTION_ID" \
  --json-auth

# Update GitHub secrets with new values
# 1. AZURE_CREDENTIALS (entire JSON)
# 2. AZURE_CLIENT_ID
# 3. AZURE_CLIENT_SECRET
# 4. AZURE_TENANT_ID

# Delete old service principal
az ad sp delete --id "old-client-id"
```

### Rotate API Keys

```bash
# 1. Generate new key on Binance
# Go to: https://www.binance.com/en/user/settings/api-management

# 2. Update GitHub secret
# Settings → Secrets → BINANCE_API_KEY

# 3. Verify new key works (run test deployment)

# 4. Delete old key from Binance
```

### Rotate Storage Keys

```bash
# Regenerate primary key
az storage account keys renew \
  --account-name "afiptfstatedev" \
  --key "primary" \
  --resource-group "afip-tfstate-rg-dev"

# Get new key
az storage account keys list \
  --account-name "afiptfstatedev" \
  --resource-group "afip-tfstate-rg-dev" \
  --query "[0].value" -o tsv

# Update Function App settings
az functionapp config appsettings set \
  --name "afip-invoice-dev-func" \
  --resource-group "afip-invoice-dev-rg" \
  --settings "STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;..."
```

---

## Troubleshooting

### 1. "Authentication failed"

```
Error: authenticating with Azure: ...
```

**Check:**
```bash
# Verify service principal exists
az ad sp show --id <CLIENT_ID>

# Verify role assignment
az role assignment list --assignee <CLIENT_ID>

# Re-authenticate
az login
```

**Fix:**
1. Verify all 5 Azure secrets are set correctly
2. Check service principal has Contributor role
3. Verify subscription ID is correct

### 2. "Backend initialization failed"

```
Error: Failed to get existing workspaces: ...
```

**Check:**
```bash
# Verify storage account exists
az storage account show \
  --name afiptfstatedev \
  --resource-group afip-tfstate-rg-dev

# Verify container exists
az storage container exists \
  --account-name afiptfstatedev \
  --name tfstate
```

**Fix:**
1. Run `scripts/terraform-backend-setup.sh dev` again
2. Verify backend secrets are correct
3. Check storage account keys haven't changed

### 3. "Key Vault access denied"

```
Error: Keyvault access denied: ...
```

**Check:**
```bash
# Verify Function App managed identity
az functionapp identity show \
  --name afip-invoice-dev-func \
  --resource-group afip-invoice-dev-rg

# Verify Key Vault access policy
az keyvault show \
  --name afip-invoice-dev-kv \
  --resource-group afip-invoice-dev-rg
```

**Fix:**
1. Check Function App has system-assigned identity
2. Verify access policy allows `Get` and `List` on secrets
3. Re-deploy Function App

### 4. "Secrets are masked in logs but still visible"

**This is a known behavior:** GitHub masks secrets in logs, but they may be visible in error messages. 

**Prevention:**
- Don't print secrets to console
- Use `sensitive = true` in Terraform
- Review logs carefully before sharing

### 5. "Secret rotation failed"

**Check:**
```bash
# View recent secret versions
az keyvault secret list-versions \
  --vault-name "afip-invoice-dev-kv" \
  --name "AFIP_CUIT"

# Get current secret
az keyvault secret show \
  --vault-name "afip-invoice-dev-kv" \
  --name "AFIP_CUIT" \
  --query value -o tsv
```

**Fix:**
1. Verify new secret value is correct
2. Ensure Function App has been restarted
3. Check Key Vault permissions
4. Test with manual deployment

---

## Security Best Practices

### ✅ DO

- [ ] Store secrets in GitHub Actions/Key Vault
- [ ] Rotate secrets quarterly (minimum)
- [ ] Use strong, random API keys
- [ ] Enable Key Vault soft delete
- [ ] Restrict service principal permissions
- [ ] Enable audit logging
- [ ] Review secret access regularly

### ❌ DON'T

- [ ] Commit secrets to git (ever!)
- [ ] Share secrets via email/chat
- [ ] Use personal access tokens
- [ ] Store plaintext secrets
- [ ] Use same secret for multiple environments
- [ ] Leave old secrets in GitHub
- [ ] Share GitHub secrets with team members directly

---

## Reference

### Useful Commands

```bash
# List all GitHub Actions secrets
# (Via UI: Settings → Secrets and variables → Actions)

# Test Azure CLI auth
az account show

# List Key Vaults
az keyvault list --query "[].name" -o table

# Test secret access
az keyvault secret show \
  --vault-name <vault-name> \
  --name <secret-name>

# Get service principal details
az ad sp show --id <CLIENT_ID>

# List role assignments
az role assignment list --assignee <CLIENT_ID>
```

---

**Version:** 1.0.0  
**Last Updated:** 2025-11-15  
**Status:** Active
