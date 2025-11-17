output "storage_account_name" {
  description = "Name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "storage_account_id" {
  description = "ID of the storage account"
  value       = azurerm_storage_account.main.id
}

output "primary_connection_string" {
  description = "Primary connection string for the storage account"
  value       = azurerm_storage_account.main.primary_connection_string
  sensitive   = true
}

output "primary_access_key" {
  description = "Primary access key for the storage account"
  value       = azurerm_storage_account.main.primary_access_key
  sensitive   = true
}

output "table_endpoint" {
  description = "Table storage endpoint"
  value       = azurerm_storage_account.main.primary_table_endpoint
}

output "orders_table_name" {
  description = "Name of the orders table"
  value       = azurerm_storage_table.orders.name
}

output "certificates_container_name" {
  description = "Name of the certificates container"
  value       = azurerm_storage_container.certificates.name
}

output "reports_container_name" {
  description = "Name of the reports container"
  value       = azurerm_storage_container.reports.name
}
