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

variable "afip_cuit" {
  description = "AFIP CUIT (tax ID)"
  type        = string
  sensitive   = true
}

variable "afip_environment" {
  description = "AFIP environment (testing or production)"
  type        = string
}

variable "afip_ptovta" {
  description = "AFIP Point of Sale number"
  type        = string
}

variable "binance_api_key" {
  description = "Binance API key"
  type        = string
  sensitive   = true
}

variable "binance_secret_key" {
  description = "Binance secret key"
  type        = string
  sensitive   = true
}

variable "storage_connection_string" {
  description = "Storage account connection string"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
