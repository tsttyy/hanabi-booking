import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export const OVERLAP_CONDITION = {
  startAt: { lt: new Date() },
};

function computeTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const copy = new Date(date);
  copy.setUTCHours(hours, minutes, 0, 0);
  return copy;
}

export async function ensureBusinessAndServiceActive(businessId: string, serviceId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business || business.status !== 'ACTIVE') {
    throw Object.assign(new Error('Business is disabled or unavailable'), { status: 400 });
  }

  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId } });
  if (!service || service.status !== 'ACTIVE') {
    throw Object.assign(new Error('Service is inactive or unavailable'), { status: 400 });
  }

  return { business, service };
}

export async function buildSlotAvailability(businessId: string, staffId: string | null, date: string, serviceDurationMinutes: number) {
  const startDate = new Date(date + 'T00:00:00.000Z');
  const endDate = new Date(date + 'T23:59:59.999Z');

  const rules = await prisma.availability.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
      ...(staffId ? { staffId } : { staffId: null }),
      dayOfWeek: new Date(date).getUTCDay(),
    },
  });

  const slots: string[] = [];
  for (const rule of rules) {
    const start = computeTime(startDate, rule.startTime);
    const end = computeTime(startDate, rule.endTime);
    let cursor = start;
    while (cursor.getTime() + serviceDurationMinutes * 60 * 1000 <= end.getTime()) {
      slots.push(cursor.toISOString());
      cursor = new Date(cursor.getTime() + serviceDurationMinutes * 60 * 1000);
    }
  }

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      businessId,
      status: { not: 'CANCELLED' },
      startAt: { gte: startDate, lte: endDate },
      ...(staffId ? { staffId } : {}),
    },
  });

  const blocked = new Set<string>();
  for (const appointment of existingAppointments) {
    for (const slot of slots) {
      const slotDate = new Date(slot);
      const s = slotDate;
      const e = new Date(slotDate.getTime() + serviceDurationMinutes * 60 * 1000);
      if (s < appointment.endAt && e > appointment.startAt) {
        blocked.add(slot);
      }
    }
  }

  return slots.filter((slot) => !blocked.has(slot));
}

export async function createAppointmentSafe(input: {
  businessId: string;
  serviceId: string;
  staffId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startAt: string;
  timezone?: string;
}) {
  const service = await prisma.service.findFirst({ where: { id: input.serviceId, businessId: input.businessId } });
  if (!service || service.status !== 'ACTIVE') {
    throw Object.assign(new Error('Service is inactive or unavailable'), { status: 400 });
  }

  const requestedStart = new Date(input.startAt);
  const requestedEnd = new Date(requestedStart.getTime() + service.durationMinutes * 60 * 1000);
  if (Number.isNaN(requestedStart.getTime()) || requestedStart < new Date(Date.now() - 60000)) {
    throw Object.assign(new Error('Appointment start time is invalid or in the past'), { status: 400 });
  }

  const business = await prisma.business.findUnique({ where: { id: input.businessId } });
  if (!business || business.status !== 'ACTIVE') {
    throw Object.assign(new Error('Business is disabled or unavailable'), { status: 400 });
  }

  const availabilityRules = await prisma.availability.findMany({
    where: {
      businessId: input.businessId,
      status: 'ACTIVE',
      ...(input.staffId ? { staffId: input.staffId } : { staffId: null }),
    },
  });

  const targetDay = requestedStart.getUTCDay();
  const withinAvailability = availabilityRules.some((rule) => {
    if (rule.dayOfWeek !== targetDay) {
      return false;
    }
    const start = new Date(requestedStart);
    start.setUTCHours(Number(rule.startTime.split(':')[0]), Number(rule.startTime.split(':')[1]), 0, 0);
    const end = new Date(requestedStart);
    end.setUTCHours(Number(rule.endTime.split(':')[0]), Number(rule.endTime.split(':')[1]), 0, 0);
    return requestedStart >= start && requestedEnd <= end;
  });

  if (!withinAvailability) {
    throw Object.assign(new Error('Requested time is outside configured availability'), { status: 400 });
  }

  const existing = await prisma.$transaction(async (tx) => {
    const conflicts = await tx.appointment.findMany({
      where: {
        businessId: input.businessId,
        status: { not: 'CANCELLED' },
        OR: [
          { staffId: input.staffId ?? null },
          { staffId: null },
        ],
      },
    });

    const overlap = conflicts.find((appointment) => {
      return appointment.startAt < requestedEnd && appointment.endAt > requestedStart && appointment.status !== 'CANCELLED';
    });

    if (overlap) {
      throw Object.assign(new Error('Appointment conflicts with an existing booking'), { status: 409 });
    }

    const customer = input.customerEmail ? await tx.customer.findUnique({ where: { email: input.customerEmail.toLowerCase().trim() } }) : null;

    const bookingReference = `HB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return tx.appointment.create({
      data: {
        businessId: input.businessId,
        serviceId: input.serviceId,
        staffId: input.staffId ?? null,
        customerId: customer?.id ?? null,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        startAt: requestedStart,
        endAt: requestedEnd,
        bookingReference,
        status: 'CONFIRMED',
      },
      include: { service: true, staff: true },
    });
  });

  return existing;
}
