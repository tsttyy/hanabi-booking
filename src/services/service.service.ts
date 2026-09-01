import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function listServicesForBusiness(businessId: string) {
  return prisma.service.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getServiceForBusiness(businessId: string, id: string) {
  return prisma.service.findFirst({ where: { id, businessId } });
}

export async function createServiceForBusiness(
  businessId: string,
  data: Omit<Prisma.ServiceUncheckedCreateInput, 'businessId'>
) {
  return prisma.service.create({ data: { ...data, businessId } });
}

export async function updateServiceForBusiness(businessId: string, id: string, data: Prisma.ServiceUpdateInput) {
  const existing = await prisma.service.findFirst({ where: { id, businessId } });
  if (!existing) return null;
  return prisma.service.update({
    where: { id },
    data,
  });
}

export async function deleteServiceForBusiness(businessId: string, id: string) {
  const existing = await prisma.service.findFirst({ where: { id, businessId } });
  if (!existing) {
    return null;
  }
  await prisma.service.delete({ where: { id } });
  return existing;
}
