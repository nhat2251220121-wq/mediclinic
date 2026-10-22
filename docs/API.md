# MediClinic API notes

API endpoints use the `/api` prefix. Authenticated endpoints require `Authorization: Bearer <token>`.

## Images

Images are stored as files under `Backend/uploads/{services,doctors}`. The database contains only relative paths such as `/uploads/services/<server-generated-id>.webp`. Uploads accept one JPEG, PNG, or WebP file in multipart field `image`, with a 5 MiB maximum. The server validates the file signature and MIME type; it does not trust the client filename or extension. Unsupported/mismatched content returns `415`, excessive size returns `413`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/admin/services/:id/image` | ADMIN | Replace service image |
| DELETE | `/api/admin/services/:id/image` | ADMIN | Remove service image |
| POST | `/api/admin/doctors/:id/avatar` | ADMIN | Replace doctor avatar |
| DELETE | `/api/admin/doctors/:id/avatar` | ADMIN | Remove doctor avatar |
| GET | `/api/doctors/me/profile` | DOCTOR | Read own profile |
| PATCH | `/api/doctors/me/profile` | DOCTOR | Edit own bio, phone, and email |
| POST | `/api/doctors/me/avatar` | DOCTOR | Replace own avatar |
| DELETE | `/api/doctors/me/avatar` | DOCTOR | Remove own avatar |

Public doctor endpoints expose the profile fields used by the directory and booking UI (name, specialty, room, bio, experience, fee, and avatar), not login credentials or account-management fields. Specialty, room, fee, account status, and role remain admin controlled.

`Backend/src/server.js` serves files at `/uploads`. If frontend and backend have different origins, set `VITE_UPLOADS_BASE_URL` in `Frontend/.env` to the backend origin (for example `https://api.example.test`) and set `VITE_API_BASE_URL` to the API base URL. Keep `Backend/uploads` on durable storage. Back it up together with the MySQL backup, preserve relative paths on restore, and include it in off-host backup/restore drills. Do not put uploaded images in the ephemeral frontend build directory.

## Doctor work schedules

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/doctors/availability/shifts` | Public | List clinic-configured shifts and times |
| GET | `/api/doctors/me/schedule` | DOCTOR | Read the caller's registered shifts |
| PUT | `/api/doctors/me/schedule` | DOCTOR | Save up to seven dates atomically |
| GET | `/api/doctors/availability/slots?doctor_id=:id&date=YYYY-MM-DD` | Public | List unbooked future appointment slots |

The schedule request body is `{ "days": [{ "work_date": "YYYY-MM-DD", "shift_ids": [1, 2] }] }`; use an empty `shift_ids` array to remove unbooked shifts for that date. All dates are interpreted in `Asia/Ho_Chi_Minh`. Each shift is divided into `BOOKING_SLOT_MINUTES` (default 30). Availability returns one `slot_id` per interval; booking locks and marks that row inside the appointment transaction, so two patients cannot claim the same slot while separate intervals in one shift remain bookable. Cancelling releases the exact interval. The server validates every date and configured shift, serializes changes against bookings, and commits the batch as one transaction. If any requested removal conflicts with a non-cancelled appointment, the request returns `409` with `data.errors` containing the date, shift, and appointment; no part of the batch is saved. Past dates and newly registering a shift that has already started today are rejected. Migration `005_appointment_time_slots.js` leaves booked legacy shifts as whole-shift unavailable rows; after handling the old appointment, the doctor can save that shift again to generate intervals. It does not move legacy appointments.

`BOOKING_SLOT_MINUTES` is read from the backend environment, defaults to `30`, and supports integers from 10 to 120 that divide each configured shift duration. Run `npm run migrate` against a backed-up test database before updating a populated clinic database. Do not run `schema.sql` on an existing database.

## Payments

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/payments/create-qr?appointmentId=:id` | Appointment owner or ADMIN | Get QR details and current outstanding balance |
| GET | `/api/payments/status/:appointmentId` | Appointment owner or ADMIN | Read server-side total, paid, due, and status |
| PATCH | `/api/invoices/:id/pay` | ADMIN | Record cash received at the counter, capped to the remaining balance |
| POST | `/api/payments/sepay-webhook` | SePay API key | Idempotently record an incoming bank transfer |
| GET | `/api/notifications` | Authenticated user | Read only the caller's notifications and unread count |
| PATCH | `/api/notifications/:id/read` | Authenticated user | Mark only the caller's notification as read |
| PATCH | `/api/notifications/read-all` | Authenticated user | Mark the caller's notifications as read |
| GET | `/api/medical-records/pending-dispensing` | ADMIN | List completed visits with prescriptions awaiting a pharmacy outcome |
| POST | `/api/medical-records/:recordId/dispense` | ADMIN | Record pharmacy-dispensed or externally purchased lines in one transaction |

Cash confirmation accepts `expectedAmount`; if the invoice balance changed since the admin reviewed it, the API returns `409 AMOUNT_CHANGED` and records nothing. Each payment row retains its own method, amount, provider reference, timestamp, and (for cash) receiving admin. Invoice responses include the payment rows and calculated totals.

Payment writers and pharmacy dispensing lock the invoice before related rows; repeated provider transaction IDs and repeat cash collection/dispensing are rejected or idempotent. Overpayments remain recorded with `OVERPAID`/`REVIEW`; no automatic refund is attempted. Cancelling a paid appointment retains all transactions and flags them for reconciliation. Listen for `payment_updated` and `notifications_updated`; always refetch server data after reconnecting or reloading. Historical VNPay rows are retained as legacy records but the application no longer starts or verifies VNPay transactions.

SePay receives the webhook only for transactions after a webhook has been enabled, unless a delivery is manually replayed from an existing delivery/incident log. A newly created webhook does not itself backfill older bank transfers. The Live Dashboard's delivery history can replay a logged delivery; if no delivery exists, use SePay's transaction reconciliation tools/API and compare the bank reference, receiving account, transfer time, amount, and `MEDICLINIC<appointmentId>` content. This project does not provide an audited manual bank-transfer entry API; do not use the cash endpoint or only change invoice status to record a transfer. Never send a fabricated payload to a Live backend. SePay Test mode is isolated and should use a dedicated test database/configuration.
