# SePay payment recovery notes

## Read-only check performed on 2026-10-06

The backend `.env` points to `mediclinic_db`. A read-only query found appointment `#2` has invoice `#2`, total `3,000.00`, `UNPAID`, and no rows in `payments`. No payment record has been added or changed. The SePay dashboard was not accessed from this workspace.

## Before touching the existing 3,000₫ transfer

1. In SePay Live, open the incoming transaction and compare the receiving account (at least the full value privately in the dashboard), amount `3,000₫`, transaction time, SePay transaction ID/reference, and transfer content `MEDICLINIC2`.
2. Check Webhooks → delivery history and incidents for that transaction. A newly created webhook only handles matching future transfers; it does not automatically backfill an earlier transfer.
3. If a failed delivery log exists, the Dashboard can replay that logged payload after the endpoint is ready. If there is no delivery/incident log, use SePay's transaction reconciliation/API process to verify the bank transaction. SePay describes replay from an existing log and transaction reconciliation in its [webhook recovery guidance](https://developer.sepay.vn/vi/sepay-webhooks/xu-ly-loi) and [reconciliation guide](https://developer.sepay.vn/vi/sepay-webhooks/doi-soat-giao-dich).
4. Before replay or any manual correction, compare all transaction values with the invoice and obtain explicit confirmation for that exact transaction. Never ask the patient to transfer again while this transfer is being checked.

The application has no audited admin API to enter a historical bank transfer manually. The admin cash endpoint writes a CASH transaction and must not be used for this bank transfer. Do not update the invoice status without a corresponding payment row. Any manual-bank reconciliation workflow would need a separate authorized, idempotent, auditable API first.

## Webhook setup

After a public endpoint has been explicitly approved and made available, configure an enabled webhook in SePay Live with event **incoming money**, the exact receiving bank account, JSON format, and API Key authentication. Enter the API key already configured as `SEPAY_API_KEY` in `Backend/.env`; never paste it into source control, chat, or a URL. Set the URL to the actual HTTPS backend endpoint ending in `/api/payments/sepay-webhook` and enable retry on delivery errors. Do not use a placeholder URL as an active endpoint.

Verify endpoint delivery only with SePay Test mode against a separate test database and test credentials. SePay documents that Test mode is isolated from Live and provides a simulated transaction flow: [Test mode quick start](https://developer.sepay.vn/vi/sepay-webhooks/test-mode/bat-dau-nhanh). Do not use a Live “send test” or any made-up payload against `mediclinic_db`.

## Temporary tunnel

Cloudflare Quick Tunnels create a public temporary hostname; anyone who obtains the URL can reach the local service. The official [Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) describes this as a testing/development workflow and says the URL stops when the `cloudflared` process stops. Only start it when the public exposure of the backend origin has been approved. Stop `cloudflared` when webhook setup/testing is complete, and update SePay if a later run generates a different URL. Keep frontend origins unchanged; the tunnel is only for inbound webhook delivery.
