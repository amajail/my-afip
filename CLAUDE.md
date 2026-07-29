# my-afip — Repo Guide

Turns Binance P2P **SELL** orders into AFIP electronic invoices for an Argentine monotributista.
Node CLI + Azure Functions API + Astro dashboard, all persisted to Azure Table Storage — no SQL,
no ORM. This repo is **public** and it files **real taxes**: a wrong constant here is a wrong tax
filing. Layering and file-by-file detail live in `ARCHITECTURE.md`; AFIP web-service specifics in
`docs/core/afip-wsfe-v1.md`; certificate setup in `docs/core/certificates.md`.

## Read this first

1. **`certificates/` holds the real AFIP certificate and `private.key`** — the identity that signs
   filings on the owner's CUIT. Gitignored *and* a path rule in `.privacy-scan.json`. A real CUIT is
   equally private — the scanner rejects anything CUIT-shaped anywhere, including this file, so take
   the placeholder from `.privacy-scan.json`'s `wording.placeholders`. In CI, certs arrive base64 in
   `AFIP_CERT_B64`/`AFIP_KEY_B64` and are decoded to disk at runtime — never into the repo.
2. **The Binance half only runs locally.** Binance P2P blocks cloud-provider IPs and needs an
   Argentine one, so `npm run binance:fetch` must run on the owner's machine. The Monday
   `weekly-invoicing.yml` run *only processes* what is already in the `orders` table. Adding a fetch
   step to any workflow does not fail loudly — it just returns nothing, and that week goes uninvoiced.
3. **AFIP 10-day rule** — an invoice must be dated within 10 days of the order (`InvoiceDateValidator`,
   `MAX_DAYS_AFTER_TRANSACTION = 10`). `skipAgeCheck` exists only for `process-month` back-filling, and
   that path deliberately invoices with **today's** date, never the order's: AFIP rejects any invoice
   dated before the last one already issued on that point of sale. Never backdate to "fix" an old order.
4. **Only a *transient* failure may leave an order unprocessed.** `CreateInvoice` re-throws TLS/network
   errors so the next run retries them, and records only AFIP rejections / `DomainError` /
   `ValidationError` as permanently failed. Widening that "permanent" branch means one AFIP outage
   burns every order it touched, forever. (Only `tradeType === 'SELL'` is invoicable at all.)
5. **AFIP's WSFEv1 endpoint negotiates a ≤1024-bit DH key** that Node/OpenSSL 3 rejects
   (`dh key too small`). The fix is an `OPENSSL_CONF` with `@SECLEVEL=0` that sets **both**
   `openssl_conf` and `nodejs_conf` — Node reads its config under the `nodejs_conf` appname and
   silently ignores the other, so setting one looks correct and does nothing. Wired in
   `weekly-invoicing.yml`; needed again for any new runner or local production call.
6. **Tests must never reach real storage.** `AzureTableDatabase` throws when `NODE_ENV=test` and the
   connection string is not Azurite. Do not relax that guard to make a test pass.

## Invoice constants — wrong value here means a wrong filing

- **Type C, `CbteTipo: 11`** (monotributista): `ImpIVA` must be `0`. Type B (`6`) is emitted only when
  VAT is present, which for this business it never is.
- **`Concepto: 2`** (services) ⇒ `FchServDesde`, `FchServHasta`, `FchVtoPago` all required. AFIP also
  demands `FchVtoPago >= CbteFch`, so `Invoice.fromOrder` clamps the due date up to the invoice date —
  without that, every back-filled invoice is rejected.
- `MonId: 'PES'`, `MonCotiz: 1`. Point of sale comes from `AFIP_PTOVTA` (`2` = "Factura en Línea —
  Monotributo"); the certificate must be authorised for that point of sale, not just for the service.
- Unidentified final consumer ⇒ `DocTipo: 99`, `DocNro: 0`.
- **`CondicionIVAReceptorId: 5`** = Consumidor Final, per "Condición Frente al IVA del receptor" in
  `afip-documentation/manual-desarrollador-ARCA-COMPG-v4-0.pdf` (last page). Mandatory since
  RG 5616/2024. It is **not** `VAT_CONDITION` in `afip.constants.js`, a different and unused table
  where `5` is No Alcanzado and `7` is final consumer — in AFIP's table `7` is Sujeto No Categorizado.
  Substituting one for the other files a valid-looking invoice against the wrong taxpayer category.
- WSAA `service` tag is **`wsfe`**, not `wsfev1`. Tickets last 12 h, cached in `.afip-tokens`. A `401`
  means the certificate is not associated with the wsfe service in the AFIP portal; propagation takes
  24–48 h, so don't respond by regenerating the certificate.

## Commands (`node src/index.js <command>`, or the npm aliases)

```bash
npm run binance:fetch [days] [type]   # LOCAL ONLY (rule 2). Binance → orders table. Default 7 SELL
npm run binance:auto  [days] [type]   # fetch + invoice in one pass, local only
npm run process:auto                  # invoice everything unprocessed — the Monday workflow's path
npm run process:month -- 2026 6       # back-fill one month: skipAgeCheck, dated today (rule 3)
npm run report                        # current-month orders + invoices; report-stats for totals
npm test                              # Jest; 57% coverage floor, CI on Node 22.x and 24.x
```

Binance caps a P2P query at **30 days**, with roughly 6 months of history available — and the path
`binance:fetch` actually uses (`getRecentP2POrders`) does *not* check that; only the unused
`getP2POrdersByDateRange` throws. Back-fill in ≤30-day chunks or the window silently returns nothing.

`process <order-number>` invoices one order. `mark-manual <order> <cae> [voucher]` records an invoice
raised by hand in the AFIP portal — use it after a `10016` / "no se corresponde con el proximo a
autorizar" warning, which means AFIP already has the voucher but this table does not.

## Deploys

- `src/functions/` → Azure Function `my-afip-func`; `dashboard/` (Astro) → Azure Static Web Apps.
  Routes, auth level and per-request certificate reconstruction: `ARCHITECTURE.md` §HTTP.
- To reprocess a month in production, use `weekly-invoicing.yml`'s `reprocess_month` input (`YYYY-MM`)
  rather than running against production storage from a laptop.
