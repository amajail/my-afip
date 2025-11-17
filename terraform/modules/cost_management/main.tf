# Consumption Budget
resource "azurerm_consumption_budget_resource_group" "main" {
  name              = "${var.resource_group_name}-budget"
  resource_group_id = var.resource_group_id

  amount     = var.monthly_budget_amount
  time_grain = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00'Z'", timestamp())
    end_date   = formatdate("YYYY-MM-01'T'00:00:00'Z'", timeadd(timestamp(), "8760h")) # 1 year from now
  }

  notification {
    enabled   = true
    threshold = var.alert_threshold
    operator  = "GreaterThan"

    contact_emails = var.contact_emails
  }

  notification {
    enabled   = true
    threshold = 100
    operator  = "GreaterThan"

    contact_emails = var.contact_emails
  }
}
