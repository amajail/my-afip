# App Service Plan (Consumption Plan for serverless)
resource "azurerm_service_plan" "main" {
  name                = "${var.resource_prefix}-plan"
  location            = var.location
  resource_group_name = var.resource_group_name
  os_type             = "Linux"
  sku_name            = "Y1" # Consumption (serverless) plan

  tags = var.tags
}

# Function App
resource "azurerm_linux_function_app" "main" {
  name                = "${var.resource_prefix}-func-${var.random_suffix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  service_plan_id     = azurerm_service_plan.main.id

  storage_account_name       = var.storage_account_name
  storage_account_access_key = var.storage_account_access_key

  https_only = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      node_version = var.node_version
    }

    # Enable Application Insights
    application_insights_connection_string = var.application_insights_connection_string
    application_insights_key               = var.application_insights_instrumentation_key

    # CORS configuration (adjust as needed)
    cors {
      allowed_origins = ["*"]
    }

    # Always on is not available in Consumption plan
    # always_on = false
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"       = "node"
    "WEBSITE_NODE_DEFAULT_VERSION"   = "~${var.node_version}"
    "WEBSITE_RUN_FROM_PACKAGE"       = "1"

    # Application configuration
    "LOG_LEVEL"                      = var.log_level
    "BINANCE_AUTO_SCHEDULE"          = var.binance_auto_schedule

    # Key Vault references (will be set after access policy)
    # Format: @Microsoft.KeyVault(SecretUri=https://<vault-name>.vault.azure.net/secrets/<secret-name>/)
    # These will be populated by the access policy data source
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [
      app_settings["AFIP_CUIT"],
      app_settings["AFIP_ENVIRONMENT"],
      app_settings["AFIP_PTOVTA"],
      app_settings["BINANCE_API_KEY"],
      app_settings["BINANCE_SECRET_KEY"],
      app_settings["STORAGE_CONNECTION_STRING"],
    ]
  }
}

# Access policy for Function App to read secrets from Key Vault
resource "azurerm_key_vault_access_policy" "function_app" {
  key_vault_id = var.key_vault_id
  tenant_id    = azurerm_linux_function_app.main.identity[0].tenant_id
  object_id    = azurerm_linux_function_app.main.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List"
  ]

  certificate_permissions = [
    "Get",
    "List"
  ]
}

# Update app settings with Key Vault references after access policy is created
resource "null_resource" "update_app_settings" {
  depends_on = [azurerm_key_vault_access_policy.function_app]

  # This is a placeholder - in practice, you'd update app settings via Azure CLI or REST API
  # For now, we'll document the Key Vault reference format in outputs

  triggers = {
    function_app_id = azurerm_linux_function_app.main.id
    key_vault_id    = var.key_vault_id
  }
}
