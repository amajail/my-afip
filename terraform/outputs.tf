output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "storage_account_name" {
  description = "Name of the storage account"
  value       = module.storage.storage_account_name
}

output "storage_table_endpoint" {
  description = "Table storage endpoint"
  value       = module.storage.table_endpoint
}

output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = module.key_vault.key_vault_name
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = module.key_vault.key_vault_uri
}

output "function_app_name" {
  description = "Name of the Function App"
  value       = module.function_app.function_app_name
}

output "function_app_default_hostname" {
  description = "Default hostname of the Function App"
  value       = module.function_app.default_hostname
}

output "function_app_principal_id" {
  description = "Principal ID of the Function App managed identity"
  value       = module.function_app.principal_id
}

output "application_insights_app_id" {
  description = "Application ID of Application Insights"
  value       = var.enable_application_insights ? module.app_insights[0].app_id : null
}

output "application_insights_instrumentation_key" {
  description = "Instrumentation key for Application Insights"
  value       = var.enable_application_insights ? module.app_insights[0].instrumentation_key : null
  sensitive   = true
}

# Function URLs for easy access
output "function_endpoints" {
  description = "Endpoints for the Azure Functions"
  value = {
    report         = "https://${module.function_app.default_hostname}/api/report"
    process_orders = "https://${module.function_app.default_hostname}/api/process-orders"
  }
}

# Deployment information
output "deployment_info" {
  description = "Information needed for deployment"
  value = {
    resource_group  = azurerm_resource_group.main.name
    function_app    = module.function_app.function_app_name
    publish_command = "func azure functionapp publish ${module.function_app.function_app_name}"
  }
}
