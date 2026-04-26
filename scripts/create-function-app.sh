#!/bin/bash
#
# Creates the Azure Function App and all required resources for the
# AFIP dashboard API.
#
# Prerequisites:
#   - Azure CLI installed (https://docs.microsoft.com/cli/azure/install-azure-cli)
#   - Logged in: az login
#   - Correct subscription selected: az account set --subscription <id>
#
# Usage:
#   ./scripts/create-function-app.sh <resource-group> <function-app-name> <azure-storage-connection-string>
#
# Example:
#   ./scripts/create-function-app.sh my-afip-rg my-afip-func "DefaultEndpointsProtocol=https;AccountName=..."
#
# After this script completes, run:
#   ./scripts/get-publish-profile.sh <function-app-name> <resource-group>
# to get the value for the AZURE_FUNCTIONAPP_PUBLISH_PROFILE GitHub secret.

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

RESOURCE_GROUP="${1:-}"
FUNCAPP_NAME="${2:-}"
DATA_STORAGE_CONN_STRING="${3:-}"

if [[ -z "$RESOURCE_GROUP" || -z "$FUNCAPP_NAME" || -z "$DATA_STORAGE_CONN_STRING" ]]; then
  echo "Usage: $0 <resource-group> <function-app-name> <azure-storage-connection-string>"
  echo ""
  echo "Example:"
  echo "  $0 my-afip-rg my-afip-func \"DefaultEndpointsProtocol=https;AccountName=...\""
  exit 1
fi

LOCATION="eastus"
# Storage account for Function App runtime (separate from data table storage).
# Must be lowercase, 3-24 chars, alphanumeric only.
FUNC_STORAGE_ACCOUNT="${FUNCAPP_NAME//[-_]/}store"
FUNC_STORAGE_ACCOUNT="${FUNC_STORAGE_ACCOUNT:0:24}"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE} AFIP Function App — Resource Provisioning  ${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Resource group:        $RESOURCE_GROUP"
echo "  Function App name:     $FUNCAPP_NAME"
echo "  Runtime storage acct:  $FUNC_STORAGE_ACCOUNT"
echo "  Location:              $LOCATION"
echo ""

# Step 1: Resource group
echo -e "${YELLOW}[1/5] Resource group...${NC}"
if az group exists --name "$RESOURCE_GROUP" | grep -q true; then
  echo -e "${GREEN}✓ Already exists${NC}"
else
  az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --tags Purpose="afip-invoice" ManagedBy="az-cli" > /dev/null
  echo -e "${GREEN}✓ Created${NC}"
fi
echo ""

# Step 2: Storage account for Function App runtime
echo -e "${YELLOW}[2/5] Storage account for Function App runtime...${NC}"
if az storage account show --name "$FUNC_STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  echo -e "${GREEN}✓ Already exists${NC}"
else
  az storage account create \
    --name "$FUNC_STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --https-only true \
    --min-tls-version TLS1_2 > /dev/null
  echo -e "${GREEN}✓ Created${NC}"
fi
echo ""

# Step 3: Function App (Consumption plan, Node 20, Linux)
echo -e "${YELLOW}[3/5] Function App (Consumption plan, Node 20)...${NC}"
if az functionapp show --name "$FUNCAPP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  echo -e "${GREEN}✓ Already exists${NC}"
else
  az functionapp create \
    --name "$FUNCAPP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --storage-account "$FUNC_STORAGE_ACCOUNT" \
    --consumption-plan-location "$LOCATION" \
    --runtime node \
    --runtime-version 20 \
    --functions-version 4 \
    --os-type Linux > /dev/null
  echo -e "${GREEN}✓ Created${NC}"
fi
echo ""

# Step 4: App settings — inject the data storage connection string
echo -e "${YELLOW}[4/5] Setting AZURE_STORAGE_CONNECTION_STRING app setting...${NC}"
az functionapp config appsettings set \
  --name "$FUNCAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings "AZURE_STORAGE_CONNECTION_STRING=$DATA_STORAGE_CONN_STRING" > /dev/null
echo -e "${GREEN}✓ Set${NC}"
echo ""

# Step 5: CORS — allow GitHub Pages
echo -e "${YELLOW}[5/5] CORS — allowing https://amajail.github.io...${NC}"
az functionapp cors add \
  --name "$FUNCAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --allowed-origins "https://amajail.github.io" > /dev/null
echo -e "${GREEN}✓ Set${NC}"
echo ""

FUNCAPP_URL="https://${FUNCAPP_NAME}.azurewebsites.net/api/orders"

echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}✓ All resources provisioned successfully!${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Get the publish profile and add it as a GitHub secret:"
echo ""
echo "     ./scripts/get-publish-profile.sh $FUNCAPP_NAME $RESOURCE_GROUP"
echo ""
echo "2. Add these to GitHub → Settings → Secrets → Actions:"
echo ""
echo "     AZURE_FUNCTIONAPP_PUBLISH_PROFILE  (from step 1)"
echo ""
echo "3. Add these to GitHub → Settings → Variables → Actions:"
echo ""
echo "     AZURE_FUNCTIONAPP_NAME  =  $FUNCAPP_NAME"
echo "     AZURE_FUNCTION_ORDERS_URL  =  $FUNCAPP_URL"
echo ""
echo "4. Trigger the deploy workflow:"
echo "     GitHub → Actions → Deploy Azure Function → Run workflow"
echo ""
