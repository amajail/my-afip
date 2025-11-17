variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "afip-invoice"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "eastus"
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Application Configuration
variable "node_version" {
  description = "Node.js version for Azure Functions"
  type        = string
  default     = "18"
}

variable "binance_auto_schedule" {
  description = "CRON schedule for automatic Binance processing (UTC)"
  type        = string
  default     = "0 9 * * *" # Daily at 9 AM UTC
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

# AFIP Configuration
variable "afip_environment" {
  description = "AFIP environment (testing or production)"
  type        = string
  default     = "testing"
  validation {
    condition     = contains(["testing", "production"], var.afip_environment)
    error_message = "AFIP environment must be testing or production."
  }
}

variable "afip_cuit" {
  description = "AFIP CUIT (tax ID) - should be provided via tfvars or environment"
  type        = string
  sensitive   = true
}

variable "afip_ptovta" {
  description = "AFIP Point of Sale number"
  type        = string
  default     = "3"
}

# Binance Configuration
variable "binance_api_key" {
  description = "Binance API key - should be provided via tfvars or environment"
  type        = string
  sensitive   = true
}

variable "binance_secret_key" {
  description = "Binance secret key - should be provided via tfvars or environment"
  type        = string
  sensitive   = true
}

# Storage Configuration
variable "storage_account_tier" {
  description = "Storage account tier"
  type        = string
  default     = "Standard"
}

variable "storage_account_replication_type" {
  description = "Storage account replication type"
  type        = string
  default     = "LRS"
}

# Monitoring Configuration
variable "enable_application_insights" {
  description = "Enable Application Insights monitoring"
  type        = bool
  default     = true
}

variable "daily_data_cap_in_gb" {
  description = "Daily data cap for Application Insights (GB)"
  type        = number
  default     = 0.1
}

# Cost Management
variable "enable_cost_alerts" {
  description = "Enable cost alerts and budgets"
  type        = bool
  default     = true
}

variable "monthly_budget_amount" {
  description = "Monthly budget amount in USD"
  type        = number
  default     = 10
}

variable "budget_alert_threshold" {
  description = "Budget alert threshold percentage"
  type        = number
  default     = 80
}
