# Hanabi Booking API

## Authentication

- All protected endpoints require a valid JWT.
- JWT is issued on login and stored in an HTTP-only cookie named `token`.
- Bearer token fallback is accepted for local testing and automation.

## Auth routes

- `POST /api/auth/login` — Login with email and password; returns session user payload and sets HTTP-only cookie.
- `POST /api/auth/logout` — Clears the auth cookie.
- `GET /api/auth/me` — Returns the authenticated user without exposing `passwordHash`.

## Business routes

- `POST /api/businesses` — System Owner only; create a business.
- `GET /api/businesses` — System Owner only; list businesses.
- `GET /api/businesses/:id` — System Owner only; fetch a business record.
- `PATCH /api/businesses/:id/status` — System Owner only; update business status.
- `GET /api/business/profile` — Business Admin only; fetch own business profile.
- `PATCH /api/business/profile` — Business Admin only; update own business profile.

## Services routes

- `GET /api/services` — Business Admin and owners can list services for the current tenant.
- `POST /api/services` — Business Admin only; create a service.
- `GET /api/services/:id` — Business Admin only; single service lookup within tenant scope.
- `PATCH /api/services/:id` — Business Admin only; update service within tenant scope.
- `DELETE /api/services/:id` — Business Admin only; delete a service.
- `GET /api/services/:id/slots?date=YYYY-MM-DD` — Generate valid appointment slots for a date.

## Staff routes

- `GET /api/staff` — Business Admin only; list staff for own business.
- `POST /api/staff` — Business Admin only; add staff.
- `GET /api/staff/:id` — Business Admin only; fetch tenant-scoped staff record.
- `PATCH /api/staff/:id` — Business Admin only; update staff.
- `DELETE /api/staff/:id` — Business Admin only; delete staff.

## Availability routes

- `GET /api/availability` — Business Admin only; list weekly availability for own business.
- `POST /api/availability` — Business Admin only; add availability slot.
- `PATCH /api/availability/:id` — Business Admin only; update availability rules.
- `DELETE /api/availability/:id` — Business Admin only; remove availability rule.

## Appointment routes

- `POST /api/appointments` — Authenticated user or admin creates an appointment with conflict checks.
- `GET /api/appointments` — Business Admin only; list appointments for own business.
- `GET /api/appointments/:id` — Business Admin only; fetch one tenant-scoped appointment.
- `PATCH /api/appointments/:id/status` — Business Admin only; update appointment status.

## Customer routes

- `POST /api/customer/auth/signup` — Public customer registration; sets HTTP-only `customerToken` cookie.
- `POST /api/customer/auth/login` — Customer login; sets HTTP-only `customerToken` cookie.
- `POST /api/customer/auth/logout` — Clears the customer auth cookie.
- `GET /api/customer/auth/me` — Authenticated customer session payload.
- `GET /api/customer/profile` / `PATCH /api/customer/profile` — Customer profile.
- `PATCH /api/customer/password` — Customer password change.
- `GET /api/customer/appointments` — Appointments linked to the authenticated customer.
- `GET /api/customer/appointments/:id` — Single customer-owned appointment.
- `PATCH /api/customer/appointments/:id/cancel` — Customer cancellation of an owned appointment.

There is no public Business Admin signup. Business Admin accounts are provisioned when a System Owner creates a business.

## Public booking routes

- `GET /api/public/businesses` — Active businesses available for customer booking.
- `GET /api/public/businesses/:businessId` — Active business details for the booking page.
- `GET /api/public/businesses/:businessId/services` — Active services for an active business.
- `GET /api/public/businesses/:businessId/staff` — Active staff for an active business.
- `GET /api/public/businesses/:businessId/services/:serviceId/slots?date=YYYY-MM-DD&staffId=:staffId` — Server-generated available slots.
- `GET /api/public/bookings?reference=:reference&email=:email` — Customer-owned booking lookup.
- `POST /api/public/bookings/cancel` — Customer self-cancellation; requires `reference` and `email` in the request body.

## Error payload format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request"
  }
}
```

## Common HTTP errors

- `400` — validation errors
- `401` — unauthenticated access
- `403` — forbidden tenant or role access
- `404` — resource not found in scope
- `409` — booking conflict or duplicate order
- `500` — unexpected server error

## Booking conflict policy

- Overlap is determined with `existing.startAt < requested.endAt && existing.endAt > requested.startAt`.
- Cancelled appointments do not block a slot.
- Inserts are guarded by a transaction and a row-locking strategy on overlapping appointment rows.
