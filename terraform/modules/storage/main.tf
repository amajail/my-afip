# Storage Account for Azure Table Storage and Function App
resource "azurerm_storage_account" "main" {
  name                     = lower(replace("${var.resource_prefix}st${var.random_suffix}", "-", ""))
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = var.account_tier
  account_replication_type = var.account_replication_type
  account_kind             = "StorageV2"
  min_tls_version          = "TLS1_2"

  enable_https_traffic_only = true

  blob_properties {
    delete_retention_policy {
      days = 7
    }
  }

  tags = var.tags
}

# Table Storage for Orders
resource "azurerm_storage_table" "orders" {
  name                 = "OrdersTable"
  storage_account_name = azurerm_storage_account.main.name
}

# Optional: Blob container for AFIP certificates if needed
resource "azurerm_storage_container" "certificates" {
  name                  = "certificates"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# Optional: Blob container for logs/reports
resource "azurerm_storage_container" "reports" {
  name                  = "reports"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}
