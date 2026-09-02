# Hanabi Booking

B2B Appointment Booking Platform.

## 1. Architecture

- **Frontend**: React + Vite (Deployed to Vercel)
- **Backend**: Node.js + Express + TypeScript (Deployed to Render or Railway as a long-running service)
- **Database**: PostgreSQL + Prisma

In production, the frontend and backend are hosted on separate domains. Communication happens via HTTPS API requests with `credentials: 'include'` to pass `HttpOnly` `Secure` `SameSite=None` authentication cookies.

## 2. Local Development

Start the local database and run the seed script:
```bash
npm run db:push
npm run db:seed
```

Start the backend:
```bash
npm run dev
# Listens on http://localhost:4000
```

Start the frontend:
```bash
cd frontend
npm run dev
# Listens on http://localhost:5173
```
Local development works exactly as before. The Vite proxy handles `/api` routes transparently.

## 3. Production Deployment

Do **NOT** use Vercel Serverless Functions for the Express backend. Express + Prisma suffers from connection exhaustion and routing issues on Vercel without specialized connection poolers. Instead, deploy the backend to a long-running Node platform (e.g. Render, Railway) and the frontend to Vercel.

## 4. Vercel Frontend Configuration

In Vercel:
1. Deploy the `frontend/` directory (or use root with `frontend/dist` output).
2. The `frontend/vercel.json` contains a SPA catch-all rewrite (`/(.*)` -> `/index.html`) to ensure paths like `/login` and `/signup` load correctly on direct browser navigation without throwing `404 NOT_FOUND`.

## 5. Backend Hosting Configuration (Render/Railway)

Deploy the Express backend as a Web Service.
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- The backend dynamically starts on `process.env.PORT` and allows CORS from `process.env.FRONTEND_ORIGIN`. 

## 6. Required Environment Variables

**Frontend (Vercel)**
- `VITE_API_BASE_URL`: `https://your-backend-app.onrender.com`

**Backend (Render/Railway)**
- `NODE_ENV`: `production`
- `DATABASE_URL`: `postgresql://user:password@host:port/dbname`
- `FRONTEND_ORIGIN`: `https://frontend-eosin-one-60.vercel.app`
- `JWT_SECRET`: A strong, random 256-bit string
- `PORT`: Automatically assigned by hosting provider, defaults to `4000`.

## 7. Database Migration & Seed Instructions

To initialize the production database safely:
```bash
# Push schema changes safely
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Provision demo data (if starting fresh)
npm run db:seed
```
*Never* run `prisma migrate reset` on a production database. 

## 8. System Owner Demo Credentials

These credentials are provisioned by the seed script.
- **Email**: `owner@example.com`
- **Password**: `Owner@12345`

*Flow*: Login -> Create Business -> Provision Admin -> Enable Business.

## 9. Business Admin Demo Credentials

Provisioned by the seed script and attached to the "Demo Business".
- **Email**: `admin@example.com`
- **Password**: `Admin@12345`

*Flow*: Login -> Dashboard -> Manage Profile, Services, Staff, Availability -> View Appointments.

## 10. Customer Signup Instructions

Customers register on the public-facing booking portal.
1. Navigate to `/customer/signup`.
2. Enter Name, Email, Password.
3. Login automatically and proceed to browse businesses.

## 11. End-to-End Test Flow

1. Customer signs up and logs in.
2. Customer navigates to `/book`, selects "Demo Business".
3. Customer selects "Consultation" service, then "Aditi Sharma" staff.
4. Customer picks a time slot and books.
5. Customer receives booking reference.
6. System Owner logs in and verifies business tenant status.
7. Business Admin logs in, verifies the appointment appeared in their tenant isolated view.

## 12. Known Limitations

- Vercel Serverless deployments are unsupported for the backend without Prisma Accelerate.
- Timezones are currently fixed to the Business's timezone during booking operations.
