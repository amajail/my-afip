variable "resource_group_id" {
  description = "ID of the resource group"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "monthly_budget_amount" {
  description = "Monthly budget amount in USD"
  type        = number
  default     = 10
}

variable "alert_threshold" {
  description = "Budget alert threshold percentage"
  type        = number
  default     = 80
}

variable "contact_emails" {
  description = "Email addresses for budget alerts"
  type        = list(string)
  default     = []
}

variable "environment" {
  description = "Environment name"
  type        = string
}
