import { prisma } from '../lib/prisma.js';

export async function listCustomerAppointments(customerId: string) {
  const appointments = await prisma.appointment.findMany({
    where: { customerId: customerId },
    include: { service: true, staff: true, business: true },
    orderBy: { startAt: 'desc' },
  });
  
  return appointments.map(apt => ({
    ...apt,
    business: {
      id: apt.business.id,
      name: apt.business.name,
      timezone: apt.business.timezone,
    },
  }));
}

export async function getCustomerAppointment(customerId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, customerId: customerId },
    include: { service: true, staff: true, business: true },
  });

  if (!appointment) {
    return null;
  }

  return {
    ...appointment,
    business: {
      id: appointment.business.id,
      name: appointment.business.name,
      timezone: appointment.business.timezone,
    },
  };
}

export async function cancelCustomerAppointment(customerId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, customerId: customerId },
  });

  if (!appointment) {
    const err = new Error('Appointment not found');
    (err as any).status = 404;
    throw err;
  }

  if (appointment.status === 'CANCELLED') {
    const err = new Error('Appointment is already cancelled');
    (err as any).status = 400;
    throw err;
  }

  if (appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW') {
    const err = new Error('Cannot cancel a completed or no-show appointment');
    (err as any).status = 400;
    throw err;
  }

  const now = new Date();
  const hoursUntilAppointment = (appointment.startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursUntilAppointment < 1) {
    const err = new Error('Cannot cancel appointments within 1 hour of start time');
    (err as any).status = 400;
    throw err;
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CANCELLED' },
    include: { service: true, staff: true, business: true },
  });

  return {
    ...updated,
    business: {
      id: updated.business.id,
      name: updated.business.name,
      timezone: updated.business.timezone,
    },
  };
}
