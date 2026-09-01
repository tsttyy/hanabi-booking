import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function listStaffForBusiness(businessId: string) {
  return prisma.staff.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getStaffForBusiness(businessId: string, id: string) {
  return prisma.staff.findFirst({ where: { id, businessId } });
}

export async function createStaffForBusiness(
  businessId: string,
  data: Omit<Prisma.StaffUncheckedCreateInput, 'businessId'>
) {
  return prisma.staff.create({ data: { ...data, businessId } });
}

export async function updateStaffForBusiness(businessId: string, id: string, data: Prisma.StaffUpdateInput) {
  const existing = await prisma.staff.findFirst({ where: { id, businessId } });
  if (!existing) return null;
  return prisma.staff.update({
    where: { id },
    data,
  });
}

export async function deleteStaffForBusiness(businessId: string, id: string) {
  const existing = await prisma.staff.findFirst({ where: { id, businessId } });
  if (!existing) return null;
  await prisma.staff.delete({ where: { id } });
  return existing;
}
