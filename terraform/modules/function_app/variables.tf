variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "random_suffix" {
  description = "Random suffix for unique names"
  type        = string
}

variable "storage_account_name" {
  description = "Name of the storage account for Function App"
  type        = string
}

variable "storage_account_access_key" {
  description = "Access key for the storage account"
  type        = string
  sensitive   = true
}

variable "key_vault_id" {
  description = "ID of the Key Vault"
  type        = string
}

variable "application_insights_connection_string" {
  description = "Application Insights connection string"
  type        = string
  sensitive   = true
  default     = null
}

variable "application_insights_instrumentation_key" {
  description = "Application Insights instrumentation key"
  type        = string
  sensitive   = true
  default     = null
}

variable "node_version" {
  description = "Node.js version"
  type        = string
  default     = "18"
}

variable "binance_auto_schedule" {
  description = "CRON schedule for Binance auto processing"
  type        = string
  default     = "0 9 * * *"
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
