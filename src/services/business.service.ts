import { BusinessStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function listBusinesses() {
  return prisma.business.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createBusiness(input: Prisma.BusinessCreateInput) {
  return prisma.business.create({ data: input });
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
