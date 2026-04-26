# Dashboard Roadmap

Read-only monitoring dashboard for monthly Binance P2P orders and AFIP invoice status.

---

## Milestone 1 — Anonymous Azure Function + Astro dashboard ✅

**Status:** Implemented on `claude/refine-local-plan-nMIkv`

### What was built

- **Azure Function** (`src/functions/orders.js`) — HTTP GET trigger (`authLevel: 'anonymous'`) backed by `AzureTableDatabase.getCurrentMonthOrders()` and `getCurrentMonthStats()`. Returns JSON with stats and order list. CORS restricted to `https://amajail.github.io`.
- **Astro dashboard** (`dashboard/`) — Static site matching the design system of `amajail.github.io` (Plus Jakarta Sans, JetBrains Mono, same CSS tokens). Deployed to GitHub Pages at `https://amajail.github.io/my-afip/`.
- **Two GitHub Actions workflows:**
  - `deploy-azure-function.yml` — triggered on changes to `src/functions/**`, deploys to Azure Function App
  - `deploy-dashboard.yml` — triggered on changes to `dashboard/**`, builds Astro and deploys to GitHub Pages

### Repository configuration required

**Secrets** (Settings → Secrets → Actions):

| Secret | Description |
|---|---|
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | Download from Azure portal → Function App → Get publish profile |
| `AZURE_STORAGE_CONNECTION_STRING` | Already used in `weekly-invoicing.yml` |

**Variables** (Settings → Variables → Actions):

| Variable | Description |
|---|---|
| `AZURE_FUNCTIONAPP_NAME` | Function App name in Azure (e.g. `my-afip-func`) |
| `AZURE_FUNCTION_ORDERS_URL` | Full function URL: `https://<funcapp>.azurewebsites.net/api/orders` |

### Manual setup after merging

1. Create an Azure Function App (Node 20, Consumption plan) via Azure portal or `infra/main.tf`
2. Add the four secrets above to repo Settings → Secrets → Actions
3. Set GitHub Pages source to **GitHub Actions** in repo Settings → Pages
4. Trigger `deploy-azure-function.yml` via `workflow_dispatch`
5. Trigger `deploy-dashboard.yml` via `workflow_dispatch`
6. Dashboard is live at `https://amajail.github.io/my-afip/`

---

## Milestone 2 — Azure Static Web Apps + authentication (future)

**Goal:** Replace GitHub Pages with Azure SWA and add identity-based access control.

- Migrate dashboard hosting from GitHub Pages → Azure Static Web Apps (free tier)
- Enable SWA built-in authentication (GitHub identity provider) — only the authenticated owner can view the dashboard
- The Azure Function keeps `authLevel: 'anonymous'` but is only reachable through SWA's auth-protected `/api` route
- Remove the public `Access-Control-Allow-Origin` header (not needed once SWA proxies requests)
- Add `azurerm_static_web_app` to Terraform infra alongside the existing function app
- No more `AZURE_FUNCTION_ORDERS_URL` secret — the SWA linked backend handles routing internally

---

## Milestone 3 — Shared design system package (future)

**Goal:** Extract the Tailwind design tokens into a reusable npm package shared by `amajail.github.io` and this dashboard.

- Create `@amajail/design-tokens` (or `@amajail/ui`) package in a new repo or as a workspace
- Package exports:
  - `tailwind.preset.mjs` — Tailwind v4 theme preset with all color tokens, shadows, fonts
  - `global.css` — base styles, `@theme` block, component utilities (`eyebrow`, `accent-line`, `card`, `badge`)
  - Optionally: shared Astro component stubs (`Layout.astro`, `StatsCard.astro`, `Badge.astro`)
- Publish via GitHub Packages (private npm registry, no public exposure)
- Both `amajail.github.io` and `my-afip/dashboard` install the package and import the preset
- A single PR to the package repo updates the design system everywhere — no token drift between projects
