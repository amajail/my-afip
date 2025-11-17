data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                = lower("${var.resource_prefix}-kv-${var.random_suffix}")
  location            = var.location
  resource_group_name = var.resource_group_name
  tenant_id           = data.azurerm_client_config.current.tenant_id

  sku_name = "standard"

  soft_delete_retention_days = 7
  purge_protection_enabled   = false

  # Allow Azure services to access
  network_acls {
    default_action = "Allow"
    bypass         = "AzureServices"
  }

  tags = var.tags
}

# Access policy for current user/service principal (for Terraform)
resource "azurerm_key_vault_access_policy" "terraform" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
    "Purge",
    "Recover"
  ]

  certificate_permissions = [
    "Get",
    "List",
    "Create",
    "Import",
    "Delete",
    "Purge",
    "Recover"
  ]
}

# Secrets
resource "azurerm_key_vault_secret" "afip_cuit" {
  name         = "AFIP-CUIT"
  value        = var.afip_cuit
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "afip_environment" {
  name         = "AFIP-ENVIRONMENT"
  value        = var.afip_environment
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "afip_ptovta" {
  name         = "AFIP-PTOVTA"
  value        = var.afip_ptovta
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "binance_api_key" {
  name         = "BINANCE-API-KEY"
  value        = var.binance_api_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "binance_secret_key" {
  name         = "BINANCE-SECRET-KEY"
  value        = var.binance_secret_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "storage_connection_string" {
  name         = "STORAGE-CONNECTION-STRING"
  value        = var.storage_connection_string
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}
