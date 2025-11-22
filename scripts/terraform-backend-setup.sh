#!/bin/bash

################################################################################
# Terraform State Backend Setup Script
# 
# This script creates the Azure Storage Account and Container for storing
# Terraform state files. It should be run ONCE before first deployment.
#
# Prerequisites:
# - Azure CLI installed and authenticated (az login)
# - Appropriate Azure subscription selected
#
# Usage:
#   ./scripts/terraform-backend-setup.sh [dev|staging|prod]
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
BASE_LOCATION="eastus"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}Error: Invalid environment. Use 'dev', 'staging', or 'prod'${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Terraform State Backend Setup - ${ENVIRONMENT}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Environment-specific settings
case "$ENVIRONMENT" in
    dev)
        RESOURCE_GROUP="afip-tfstate-rg-dev"
        STORAGE_ACCOUNT="afiptfstatedev"
        STATE_KEY="afip-invoice-dev.tfstate"
        ;;
    staging)
        RESOURCE_GROUP="afip-tfstate-rg-staging"
        STORAGE_ACCOUNT="afiptfstatestaging"
        STATE_KEY="afip-invoice-staging.tfstate"
        ;;
    prod)
        RESOURCE_GROUP="afip-tfstate-rg-prod"
        STORAGE_ACCOUNT="afiptfstateprod"
        STATE_KEY="afip-invoice-prod.tfstate"
        ;;
esac

CONTAINER_NAME="tfstate"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Environment: $ENVIRONMENT"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Storage Account: $STORAGE_ACCOUNT"
echo "  Container: $CONTAINER_NAME"
echo "  State Key: $STATE_KEY"
echo ""

# Get current subscription
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo -e "${BLUE}Current Subscription: ${NC}$SUBSCRIPTION_ID"
echo ""

# Step 1: Create Resource Group
echo -e "${YELLOW}Step 1: Creating Resource Group...${NC}"
if az group exists --name "$RESOURCE_GROUP" | grep -q true; then
    echo -e "${GREEN}✓ Resource group '$RESOURCE_GROUP' already exists${NC}"
else
    echo "Creating resource group '$RESOURCE_GROUP'..."
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$BASE_LOCATION" \
        --tags \
            Environment="terraform-state" \
            Purpose="terraform-backend" \
            ManagedBy="script"
    echo -e "${GREEN}✓ Resource group created${NC}"
fi
echo ""

# Step 2: Create Storage Account
echo -e "${YELLOW}Step 2: Creating Storage Account...${NC}"
# 'az storage account exists' is not a valid az command on all CLI versions.
# Use 'az storage account show' to check existence (exit code 0 => exists).
if az storage account show --name "$STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Storage account '$STORAGE_ACCOUNT' already exists${NC}"
else
    echo "Creating storage account '$STORAGE_ACCOUNT'..."
    az storage account create \
        --name "$STORAGE_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$BASE_LOCATION" \
        --sku Standard_LRS \
        --kind StorageV2 \
        --https-only true \
        --min-tls-version TLS1_2 \
        --default-action Deny \
        --tags \
            Environment="terraform-state" \
            Purpose="terraform-backend" \
            ManagedBy="script"
    echo -e "${GREEN}✓ Storage account created${NC}"
fi
echo ""

# Step 3: Create Storage Container
echo -e "${YELLOW}Step 3: Creating Storage Container...${NC}"

# Get storage account key
STORAGE_KEY=$(az storage account keys list \
    --resource-group "$RESOURCE_GROUP" \
    --account-name "$STORAGE_ACCOUNT" \
    --query '[0].value' -o tsv)

# Check if container exists
CONTAINER_EXISTS=$(az storage container exists \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$STORAGE_KEY" \
    --name "$CONTAINER_NAME" \
    --query exists -o tsv)

if [ "$CONTAINER_EXISTS" = true ]; then
    echo -e "${GREEN}✓ Container '$CONTAINER_NAME' already exists${NC}"
else
    echo "Creating container '$CONTAINER_NAME'..."
    az storage container create \
        --name "$CONTAINER_NAME" \
        --account-name "$STORAGE_ACCOUNT" \
        --account-key "$STORAGE_KEY"
    echo -e "${GREEN}✓ Container created${NC}"
fi
echo ""

# Step 4: Enable versioning and soft delete (for safety)
echo -e "${YELLOW}Step 4: Configuring Storage Account for safety...${NC}"
az storage account blob-service-properties update \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$STORAGE_KEY" \
    --enable-change-feed true \
    --enable-versioning true \
    2>/dev/null || echo "Versioning may already be enabled"
echo -e "${GREEN}✓ Storage account configured${NC}"
echo ""

# Step 5: Display configuration for GitHub Actions
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Backend setup complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Add these secrets to GitHub Actions:${NC}"
echo ""
echo "Repository Settings → Secrets and variables → Actions"
echo ""

case "$ENVIRONMENT" in
    dev)
        echo "1. TF_STATE_RG_DEV = $RESOURCE_GROUP"
        echo "2. TF_STATE_STORAGE_DEV = $STORAGE_ACCOUNT"
        echo "3. TF_STATE_KEY_DEV = $STATE_KEY"
        ;;
    staging)
        echo "1. TF_STATE_RG_STAGING = $RESOURCE_GROUP"
        echo "2. TF_STATE_STORAGE_STAGING = $STORAGE_ACCOUNT"
        echo "3. TF_STATE_KEY_STAGING = $STATE_KEY"
        ;;
    prod)
        echo "1. TF_STATE_RG_PROD = $RESOURCE_GROUP"
        echo "2. TF_STATE_STORAGE_PROD = $STORAGE_ACCOUNT"
        echo "3. TF_STATE_KEY_PROD = $STATE_KEY"
        ;;
esac

echo ""
echo -e "${YELLOW}TF_STATE_CONTAINER = $CONTAINER_NAME${NC}"
echo "(Add once, used by all environments)"
echo ""

# Step 6: Test connection
echo -e "${YELLOW}Step 5: Testing connection...${NC}"
if az storage blob list \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$STORAGE_KEY" \
    --container-name "$CONTAINER_NAME" \
    --output none 2>/dev/null; then
    echo -e "${GREEN}✓ Connection test successful${NC}"
else
    echo -e "${RED}✗ Connection test failed${NC}"
fi
echo ""

# Step 7: Local backend configuration
echo -e "${YELLOW}Step 6: Creating local backend configuration...${NC}"
BACKEND_CONFIG_FILE="terraform/backend-${ENVIRONMENT}.tfbackend"
cat > "$BACKEND_CONFIG_FILE" << EOF
# Auto-generated backend configuration for $ENVIRONMENT environment
# Generated on: $(date)

resource_group_name  = "$RESOURCE_GROUP"
storage_account_name = "$STORAGE_ACCOUNT"
container_name       = "$CONTAINER_NAME"
key                  = "$STATE_KEY"
EOF
echo -e "${GREEN}✓ Created $BACKEND_CONFIG_FILE${NC}"
echo ""

# Step 8: Instructions for use
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "1. Add secrets to GitHub Actions:"
echo "   - Go to: https://github.com/amajail/my-afip/settings/secrets/actions"
echo "   - Add the secrets listed above"
echo ""
echo "2. For local development, initialize Terraform:"
echo "   cd terraform"
echo "   terraform init -backend-config=backend-${ENVIRONMENT}.tfbackend"
echo ""
echo "3. Test the backend:"
echo "   terraform state list"
echo ""
echo -e "${GREEN}Backend setup is complete!${NC}"
