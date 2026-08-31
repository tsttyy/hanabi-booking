import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type AppointmentStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export async function listAppointmentsForBusiness(businessId: string) {
  return prisma.appointment.findMany({
    where: { businessId },
    include: { service: true, staff: true },
    orderBy: { startAt: 'asc' },
  });
}

export async function getAppointmentForBusiness(businessId: string, id: string) {
  return prisma.appointment.findFirst({
    where: { id, businessId },
    include: { service: true, staff: true },
  });
}

export async function updateAppointmentStatusForBusiness(businessId: string, id: string, status: string) {
  const existing = await prisma.appointment.findFirst({ where: { id, businessId } });
  if (!existing) return null;
  return prisma.appointment.update({
    where: { id },
    data: { status: status as AppointmentStatus },
  });
}
