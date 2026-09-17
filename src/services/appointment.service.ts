import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type AppointmentStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export async function listAppointmentsForBusiness(
  businessId: string,
  options?: { from?: string; to?: string; status?: AppointmentStatus }
) {
  const where: Prisma.AppointmentWhereInput = { businessId };
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.from || options?.to) {
    where.startAt = {};
    if (options.from) where.startAt.gte = new Date(options.from);
    if (options.to) where.startAt.lte = new Date(options.to);
  }

  return prisma.appointment.findMany({
    where,
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

  // Prevent reversing a CANCELLED status, or transitioning from COMPLETED/NO_SHOW back to CONFIRMED
  if (existing.status === 'CANCELLED' && status !== 'CANCELLED') {
    throw Object.assign(new Error('Cannot change status of a cancelled appointment'), { status: 400 });
  }
  if ((existing.status === 'COMPLETED' || existing.status === 'NO_SHOW') && status === 'CONFIRMED') {
    throw Object.assign(new Error(`Cannot revert ${existing.status} appointment back to CONFIRMED`), { status: 400 });
  }

  return prisma.appointment.update({
    where: { id },
    data: { status: status as AppointmentStatus },
  });
}
