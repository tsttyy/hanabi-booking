import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { AuthUser, signToken } from '../middleware/auth.js';
import { normalizeEmail } from '../utils/api.js';

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return null;
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return null;
  }

  const authUser: AuthUser = {
    id: user.id,
    businessId: user.businessId,
    email: user.email,
    role: user.role,
    status: user.status,
  };

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      businessId: user.businessId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token: signToken(authUser),
  };
}
