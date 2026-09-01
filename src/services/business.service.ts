import { BusinessStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

export async function listBusinesses() {
  return prisma.business.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createBusiness(input: Prisma.BusinessCreateInput & { adminName?: string; adminEmail?: string; adminPassword?: string }) {
  const { adminName, adminEmail, adminPassword, ...businessData } = input;
  
  if (!adminName || !adminEmail || !adminPassword) {
    throw Object.assign(new Error('Admin details are required'), { status: 400 });
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  return prisma.$transaction(async (tx) => {
    const business = await tx.business.create({ data: businessData });
    await tx.user.create({
      data: {
        name: adminName,
        email: adminEmail.toLowerCase().trim(),
        passwordHash,
        role: 'BUSINESS_ADMIN',
        businessId: business.id,
      },
    });
    return business;
  });
}

export async function getBusinessById(id: string) {
  return prisma.business.findUnique({ where: { id } });
}

export async function updateBusinessStatus(id: string, status: BusinessStatus) {
  return prisma.business.update({ where: { id }, data: { status } });
}

export async function getBusinessProfile(id: string) {
  return prisma.business.findFirst({ where: { id } });
}

export async function updateBusinessProfile(id: string, data: Prisma.BusinessUpdateInput) {
  return prisma.business.update({ where: { id }, data });
}
