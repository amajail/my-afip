output "budget_id" {
  description = "ID of the consumption budget"
  value       = azurerm_consumption_budget_resource_group.main.id
}

output "budget_name" {
  description = "Name of the consumption budget"
  value       = azurerm_consumption_budget_resource_group.main.name
}
