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
| POST | `/api/payments/create-qr` | Appointment owner or ADMIN | Select QR, clear a pending cash request, and return the latest QR balance |
| GET | `/api/payments/status/:appointmentId` | Appointment owner or ADMIN | Read server-side total, paid, due, and status |
| POST | `/api/invoices/:id/cash-request` | PATIENT (owner only) | Persist a pending cash-at-counter request; does not create a payment row or mark paid |
| PATCH | `/api/invoices/:id/pay` | ADMIN | Record cash received at the counter, capped to the remaining balance |
| POST | `/api/payments/sepay-webhook` | SePay API key | Idempotently record an incoming bank transfer |
| GET | `/api/notifications` | PATIENT | Read only the caller's notifications and unread count |
| PATCH | `/api/notifications/:id/read` | PATIENT | Mark only the caller's notification as read (idempotent) |
| PATCH | `/api/notifications/read-all` | PATIENT | Mark the caller's notifications as read |
| GET | `/api/medical-records/follow-ups?date=YYYY-MM-DD` | DOCTOR | List only the caller doctor's follow-up records for a clinic date; `follow_up_appointment_id` is null when no new booking exists |
| GET | `/api/medical-records/pending-dispensing` | ADMIN | List completed visits with prescriptions awaiting a pharmacy outcome |
| POST | `/api/medical-records/:recordId/dispense` | ADMIN | Record pharmacy-dispensed or externally purchased lines in one transaction |

When a doctor saves a medical record, the backend validates each active drug's catalog price (> 0), snapshots it on the prescription, inserts medicine invoice lines, and recalculates the invoice in the same transaction. It creates one deduplicated `MEDICAL_RECORD_READY` notice and synchronizes one current invoice notice; a follow-up date creates its own informational notice. Patient record APIs are scoped to the authenticated patient, and prescription history is included.

The pharmacy endpoint is now delivery/inventory only for prescriptions marked `BILLED`; it requires the invoice to be fully paid before stock is deducted. The additive migration `011_invoice_prescription_billing_and_cash_request.js` adds `prescriptions.billing_status` and `invoices.cash_requested_at`. Existing prescriptions default to `UNBILLED`; on first pharmacy processing they are billed once from their saved `unit_price` snapshot. If the legacy snapshot is zero/invalid, processing stops for admin review; no price is invented. If that billing leaves a balance, it commits only the invoice lines and asks for payment; a later request may deliver the medicine after full payment.

Saving a medical record with `follow_up_date` writes the follow-up row and a `FOLLOW_UP` patient notification in the same transaction. The message includes only the follow-up date and public doctor/service names; it excludes diagnoses, symptoms, and instructions. Migration `008_followup_notifications.js` adds the informational `INFO` notification status while retaining existing notification statuses. Apply pending migrations only after backing up and testing against a separate database; do not run `schema.sql` against a populated clinic database.

`GET /api/medical-records/catalog` returns the ICD-10 catalog from `icd10_codes`; the doctor may search by code/title, leave it blank, and chooses manually. `GET /api/medical-records/:id` and `GET /api/medical-records` include `icd10_description` when the code exists. Migration `009_seed_icd10_starter_catalog.js` adds a small, WHO-sourced starter catalog to empty entries without overwriting existing rows; it is not a complete coding dataset. See [ICD10-CATALOG.md](ICD10-CATALOG.md). Migration `010_add_meal_independent_option.js` adds the explicit “Không phụ thuộc bữa ăn” catalog choice. Empty `meal_relation_id` remains compatible and displays as “Không chỉ định”. New prescription form requests may omit legacy `frequency` and `time_ids`; the backend still stores/returns those existing fields for older prescriptions.

Cash confirmation accepts `expectedAmount`; if the invoice balance changed since the admin reviewed it, the API returns `409 AMOUNT_CHANGED` and records nothing. Each payment row retains its own method, amount, provider reference, timestamp, and (for cash) receiving admin. Invoice responses include itemized service/medicine lines, payment rows, method, pending cash timestamp, and calculated totals. A cash request remains unpaid until an admin confirms actual receipt.

Payment writers and pharmacy dispensing lock the invoice before related rows; repeated provider transaction IDs and repeat cash collection/dispensing are rejected or idempotent. Overpayments remain recorded with `OVERPAID`/`REVIEW`; no automatic refund is attempted. Cancelling a paid appointment retains all transactions and flags them for reconciliation. Listen for `payment_updated` and `notifications_updated`; always refetch server data after reconnecting or reloading. Historical VNPay rows are retained as legacy records but the application no longer starts or verifies VNPay transactions.

SePay receives the webhook only for transactions after a webhook has been enabled, unless a delivery is manually replayed from an existing delivery/incident log. A newly created webhook does not itself backfill older bank transfers. The Live Dashboard's delivery history can replay a logged delivery; if no delivery exists, use SePay's transaction reconciliation tools/API and compare the bank reference, receiving account, transfer time, amount, and `MEDICLINIC<appointmentId>` content. This project does not provide an audited manual bank-transfer entry API; do not use the cash endpoint or only change invoice status to record a transfer. Never send a fabricated payload to a Live backend. SePay Test mode is isolated and should use a dedicated test database/configuration.
