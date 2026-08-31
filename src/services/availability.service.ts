import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function listAvailabilityForBusiness(businessId: string) {
  return prisma.availability.findMany({
    where: { businessId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

export async function createAvailabilityForBusiness(
  businessId: string,
  data: Omit<Prisma.AvailabilityUncheckedCreateInput, 'businessId'>
) {
  return prisma.availability.create({ data: { ...data, businessId } });
}

export async function updateAvailabilityForBusiness(businessId: string, id: string, data: Prisma.AvailabilityUpdateInput) {
  return prisma.availability.update({
    where: { id },
    data,
  });
}

export async function deleteAvailabilityForBusiness(businessId: string, id: string) {
  const existing = await prisma.availability.findFirst({ where: { id, businessId } });
  if (!existing) return null;
  await prisma.availability.delete({ where: { id } });
  return existing;
}
