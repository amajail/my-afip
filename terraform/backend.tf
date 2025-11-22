terraform {
  required_version = ">= 1.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Backend configuration for remote state storage
  # The backend configuration is done via -backend-config flags in the CI/CD pipeline
  # or via environment variables for local development
  #
  # For local development, create a backend config file:
  # terraform init -backend-config=backend-config.tfbackend
  #
  # Example backend-config.tfbackend:
  # resource_group_name  = "afip-tfstate-rg"
  # storage_account_name = "afiptfstateDEV"
  # container_name       = "tfstate"
  # key                  = "afip-invoice-dev.tfstate"
  backend "azurerm" {
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}
