# Hanabi Booking

## Development demo credentials

These credentials are for local development only. The seed script provisions the accounts and associated demo business data.

| Role | Email | Password |
| --- | --- | --- |
| System Owner | `owner@example.com` | `Owner@12345` |
| Business Admin | `admin@example.com` | `Admin@12345` |

Run `npm run db:seed` to provision or refresh the local demo accounts. The Business Admin belongs to the active **Demo Business**, which includes active services, staff, and availability for browser booking tests.

Local development endpoints:

- Frontend: `http://localhost:5173`
- Backend API: `http://127.0.0.1:4000`
- PostgreSQL: `127.0.0.1:5432` (`hanabi`)
