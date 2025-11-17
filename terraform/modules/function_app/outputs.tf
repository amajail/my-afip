output "function_app_name" {
  description = "Name of the Function App"
  value       = azurerm_linux_function_app.main.name
}

output "function_app_id" {
  description = "ID of the Function App"
  value       = azurerm_linux_function_app.main.id
}

output "default_hostname" {
  description = "Default hostname of the Function App"
  value       = azurerm_linux_function_app.main.default_hostname
}

output "principal_id" {
  description = "Principal ID of the Function App managed identity"
  value       = azurerm_linux_function_app.main.identity[0].principal_id
}

output "tenant_id" {
  description = "Tenant ID of the Function App managed identity"
  value       = azurerm_linux_function_app.main.identity[0].tenant_id
}

output "outbound_ip_addresses" {
  description = "Outbound IP addresses of the Function App"
  value       = azurerm_linux_function_app.main.outbound_ip_addresses
}
