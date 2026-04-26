#!/bin/bash
#
# Fetches the Azure Function App publish profile and prints the value
# to set as the AZURE_FUNCTIONAPP_PUBLISH_PROFILE GitHub secret.
#
# Prerequisites:
#   - Azure CLI installed (https://docs.microsoft.com/cli/azure/install-azure-cli)
#   - Logged in: az login
#   - Correct subscription selected: az account set --subscription <id>
#
# Usage:
#   ./scripts/get-publish-profile.sh <function-app-name> <resource-group>
#
# Example:
#   ./scripts/get-publish-profile.sh my-afip-func my-afip-rg

set -euo pipefail

FUNCAPP_NAME="${1:-}"
RESOURCE_GROUP="${2:-}"

if [[ -z "$FUNCAPP_NAME" || -z "$RESOURCE_GROUP" ]]; then
  echo "Usage: $0 <function-app-name> <resource-group>"
  echo ""
  echo "Example: $0 my-afip-func my-afip-rg"
  exit 1
fi

echo "Fetching publish profile for '$FUNCAPP_NAME' in '$RESOURCE_GROUP'..."
echo ""

PROFILE=$(az functionapp deployment list-publishing-profiles \
  --name "$FUNCAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --xml 2>/dev/null)

if [[ -z "$PROFILE" ]]; then
  echo "ERROR: Could not retrieve publish profile. Check the app name and resource group."
  exit 1
fi

echo "==========================================================="
echo " Copy everything between the lines below and paste it as"
echo " the AZURE_FUNCTIONAPP_PUBLISH_PROFILE secret in:"
echo " GitHub → Settings → Secrets → Actions → New secret"
echo "==========================================================="
echo ""
echo "$PROFILE"
echo ""
echo "==========================================================="
