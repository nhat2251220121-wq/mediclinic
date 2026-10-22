# Local SePay webhook gateway

The gateway listens only on `127.0.0.1:5001` by default and forwards exactly:

- `GET /health` → backend `GET /api/health`
- `POST /api/payments/sepay-webhook` → backend `POST /api/payments/sepay-webhook`

All other paths/methods are rejected locally. Webhook requests must be JSON and are limited to 64 KiB. The gateway does not authenticate SePay itself; the backend's `Authorization: Apikey …` check remains enabled and the header is forwarded unchanged. Do not disable or replace `SEPAY_API_KEY` authentication.

## Backup and migration status

Before changing or restarting services, make a private backup. In PowerShell, use the installed MySQL 9 client path shown below; the password prompt is interactive and the password does not appear in shell history:

```powershell
$dump = 'C:\Program Files\MySQL\MySQL Server 9.0\bin\mysqldump.exe'
$dbUser = 'root' # replace with DB_USER from Backend/.env
$backupDir = Join-Path $env:USERPROFILE 'Documents\MediClinic-backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backupFile = Join-Path $backupDir ("mediclinic_db-{0}.sql" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
& $dump --host=localhost --port=3306 "--user=$dbUser" --password --single-transaction --routines --triggers --events --hex-blob "--result-file=$backupFile" mediclinic_db
if ($LASTEXITCODE -ne 0) { throw 'mysqldump failed; do not continue.' }
Get-Item -LiteralPath $backupFile | Select-Object FullName, Length, LastWriteTime
```

Protect the output file because it contains clinic and patient data. Do not place it in the source repository.

The read-only check performed on 2026-10-06 found migrations `001` through `005` recorded in `mediclinic_db`; `shift_time_slots` exists with 48 rows and `appointments.slot_id` exists. Migration `005_appointment_time_slots.js` has already run. Do not run `npm run migrate` against `mediclinic_db` as part of this test. Use a separate, disposable database with an explicit test `.env` for integration testing.

To inspect migration history read-only using the installed MySQL client:

```powershell
$mysql = 'C:\Program Files\MySQL\MySQL Server 9.0\bin\mysql.exe'
$dbUser = 'root' # replace with DB_USER from Backend/.env
& $mysql --host=localhost --port=3306 "--user=$dbUser" --password --database=mediclinic_db --execute='SELECT version, applied_at FROM schema_migrations ORDER BY version; SELECT COUNT(*) AS slot_rows FROM shift_time_slots; SELECT COUNT(*) AS slot_id_column FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ''appointments'' AND column_name = ''slot_id'';'
```

## Find and restart the backend

Check who owns port 5000 before stopping anything:

```powershell
$listener = Get-NetTCPConnection -State Listen -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
  $owner | Select-Object ProcessId, Name, ExecutablePath, CommandLine, CreationDate | Format-List
} else { 'No backend is listening on port 5000.' }
```

The check performed on 2026-10-06 found no listener and no running Node process for this project, so there was no PID to stop. If a later check finds one, confirm the command line points to this workspace before stopping that exact PID:

```powershell
Stop-Process -Id <PID_FROM_THE_CHECK> -Confirm
```

Then start the backend in its own terminal (do not run `npm run migrate`):

```powershell
Set-Location 'D:\doanphongkham\Backend'
npm start
```

In another PowerShell window, verify health and the new appointment-slot API after the backend starts:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
# Public availability read; replace doctor/date with a valid doctor and future clinic date.
Invoke-RestMethod 'http://localhost:5000/api/doctors/availability/slots?doctor_id=1&date=2026-10-07'
```

Availability rows should have 30-minute `time_slot` intervals and a `slot_id`. This GET is read-only.

## Start the gateway and Quick Tunnel yourself

The previous automatic review rejected launching a tunnel to the entire backend. The gateway provides the requested path allowlist; I did not retry the tunnel. Once the backend is listening and you are ready to make these two gateway routes public, use two PowerShell windows:

Window 1, from `D:\doanphongkham\Backend`:

```powershell
npm run webhook-gateway
```

Window 2, using the downloaded, Cloudflare-signed executable in the current user's temp directory:

```powershell
$cloudflared = Join-Path $env:TEMP 'cloudflared-windows-amd64.exe'
& $cloudflared tunnel --url http://127.0.0.1:5001 --no-autoupdate
```

`cloudflared` prints the actual temporary HTTPS hostname. Use that printed hostname with `/api/payments/sepay-webhook` in SePay. Do not use a placeholder. Anyone with the tunnel URL can reach the gateway's two allowed routes. Keep the gateway and tunnel terminals open; stop each with `Ctrl+C`. When the temporary URL changes, update SePay.

In SePay Live, configure **incoming money**, the exact receiving bank account, JSON, API Key authentication, and the `Authorization: Apikey …` value matching `SEPAY_API_KEY` in `Backend/.env`; keep automatic retry enabled. Do not use a Live send-test action against `mediclinic_db`. For simulated webhook testing, use SePay Test mode and a separate test database.

## Existing 3,000₫ transfer

Do not ask the patient to pay again. Before replay or manual reconciliation, compare the SePay transaction ID/reference, exact content `MEDICLINIC2`, amount `3,000₫`, incoming direction, receiving account, and transaction time against the bank/SePay record and invoice. The database currently shows appointment #2's invoice as `UNPAID` with no payment rows. Do not mark it paid or use the cash endpoint. No transaction has been replayed or written by this gateway setup.
