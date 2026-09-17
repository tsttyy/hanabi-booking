import dotenv from 'dotenv';

dotenv.config();

const frontendOrigins = (process.env.FRONTEND_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173,https://frontend-fb6k02afn-tsttyys-projects.vercel.app')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nodeEnv = process.env.NODE_ENV ?? 'development';
const rawJwtSecret = process.env.JWT_SECRET;

if (nodeEnv === 'production' && (!rawJwtSecret || rawJwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long in production');
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: rawJwtSecret || 'change-me-in-production',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:<replace-with-real-password>@127.0.0.1:5432/hanabi',
  nodeEnv,
  frontendOrigins,
};
