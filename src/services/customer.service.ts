import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { AuthCustomer, signCustomerToken } from '../middleware/auth.js';
import { normalizeEmail } from '../utils/api.js';

export async function signupCustomer(name: string, email: string, password: string, phone?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  
  // Check if email already exists
  const existing = await prisma.customer.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    const err = new Error('An account with this email already exists');
    (err as any).status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const customer = await prisma.customer.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      phone: phone || null,
      status: 'ACTIVE',
    },
  });

  const authCustomer: AuthCustomer = {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    status: customer.status,
  };

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      status: customer.status,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
    token: signCustomerToken(authCustomer),
  };
}

export async function authenticateCustomer(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const customer = await prisma.customer.findUnique({ where: { email: normalizedEmail } });
  if (!customer) {
    return null;
  }

  const passwordValid = await bcrypt.compare(password, customer.passwordHash);
  if (!passwordValid) {
    return null;
  }

  if (customer.status !== 'ACTIVE') {
    return null;
  }

  const authCustomer: AuthCustomer = {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    status: customer.status,
  };

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      status: customer.status,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
    token: signCustomerToken(authCustomer),
  };
}

export async function getCustomerProfile(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return null;
  }

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    status: customer.status,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export async function updateCustomerProfile(customerId: string, name?: string, phone?: string | null) {
  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(name ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
    },
  });

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    status: customer.status,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export async function changeCustomerPassword(customerId: string, currentPassword: string, newPassword: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const err = new Error('Customer not found');
    (err as any).status = 404;
    throw err;
  }

  const passwordValid = await bcrypt.compare(currentPassword, customer.passwordHash);
  if (!passwordValid) {
    const err = new Error('Current password is incorrect');
    (err as any).status = 400;
    throw err;
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  await prisma.customer.update({
    where: { id: customerId },
    data: { passwordHash: newPasswordHash },
  });
}
