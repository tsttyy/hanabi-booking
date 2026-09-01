import { prisma } from '../lib/prisma.js';

const businessFields = { id: true, name: true, contactEmail: true, contactPhone: true, timezone: true } as const;

export function listActiveBusinesses() {
  return prisma.business.findMany({
    where: { status: 'ACTIVE' },
    select: businessFields,
    orderBy: { name: 'asc' },
  });
}

export function getActiveBusiness(id: string) {
  return prisma.business.findFirst({ where: { id, status: 'ACTIVE' }, select: businessFields });
}

export function listActiveServices(businessId: string) {
  return prisma.service.findMany({ where: { businessId, status: 'ACTIVE' }, select: { id: true, name: true, description: true, durationMinutes: true }, orderBy: { name: 'asc' } });
}

export function listActiveStaff(businessId: string) {
  return prisma.staff.findMany({ where: { businessId, status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
}

export async function getBookingContext(businessId: string, serviceId: string, staffId: string | null) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId, status: 'ACTIVE' }, select: { durationMinutes: true } });
  if (!service) return null;
  if (staffId && !await prisma.staff.findFirst({ where: { id: staffId, businessId, status: 'ACTIVE' }, select: { id: true } })) return null;
  return service;
}

export function getBookingForCustomer(bookingReference: string, customerEmail: string) {
  return prisma.appointment.findFirst({
    where: { bookingReference, customerEmail },
    include: { business: { select: businessFields }, service: true, staff: true },
  });
}

export async function cancelBookingForCustomer(bookingReference: string, customerEmail: string) {
  const appointment = await prisma.appointment.findFirst({ where: { bookingReference, customerEmail } });
  if (!appointment) return null;
  if (appointment.status === 'CANCELLED') return appointment;
  return prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELLED' } });
}
