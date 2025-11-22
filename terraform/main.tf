locals {
  common_tags = merge(
    var.tags,
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
  resource_prefix = "${var.project_name}-${var.environment}"
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${local.resource_prefix}-rg"
  location = var.location
  tags     = local.common_tags
}

# Random suffix for globally unique names
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Storage Account for Table Storage and Function App
module "storage" {
  source = "./modules/storage"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  resource_prefix     = local.resource_prefix
  random_suffix       = random_string.suffix.result

  account_tier             = var.storage_account_tier
  account_replication_type = var.storage_account_replication_type

  tags = local.common_tags
}

# Key Vault for secrets management
module "key_vault" {
  source = "./modules/key_vault"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  resource_prefix     = local.resource_prefix
  random_suffix       = random_string.suffix.result

  # Secrets to store
  afip_cuit          = var.afip_cuit
  afip_environment   = var.afip_environment
  afip_ptovta        = var.afip_ptovta
  binance_api_key    = var.binance_api_key
  binance_secret_key = var.binance_secret_key

  storage_connection_string = module.storage.primary_connection_string

  tags = local.common_tags
}

# Application Insights for monitoring
module "app_insights" {
  source = "./modules/app_insights"

  count = var.enable_application_insights ? 1 : 0

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  resource_prefix     = local.resource_prefix

  daily_data_cap_in_gb = var.daily_data_cap_in_gb

  tags = local.common_tags
}

# Azure Function App
module "function_app" {
  source = "./modules/function_app"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  resource_prefix     = local.resource_prefix
  random_suffix       = random_string.suffix.result

  storage_account_name       = module.storage.storage_account_name
  storage_account_access_key = module.storage.primary_access_key

  key_vault_id = module.key_vault.key_vault_id

  application_insights_connection_string = var.enable_application_insights ? module.app_insights[0].connection_string : null
  application_insights_instrumentation_key = var.enable_application_insights ? module.app_insights[0].instrumentation_key : null

  node_version            = var.node_version
  binance_auto_schedule   = var.binance_auto_schedule
  log_level               = var.log_level

  tags = local.common_tags
}

# Budget and Cost Alerts
module "cost_management" {
  source = "./modules/cost_management"

  count = var.enable_cost_alerts ? 1 : 0

  resource_group_id   = azurerm_resource_group.main.id
  resource_group_name = azurerm_resource_group.main.name

  monthly_budget_amount = var.monthly_budget_amount
  alert_threshold       = var.budget_alert_threshold

  environment = var.environment
}
