import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

const app = createApp();

const ownerPayload = { email: 'owner@example.com', password: 'Owner@12345' };
const adminPayload = { email: 'admin@example.com', password: 'Admin@12345' };

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('Hanabi booking backend', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.availability.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.service.deleteMany();
    await prisma.business.deleteMany();

    const businessA = await prisma.business.create({
      data: {
        name: 'Business A',
        contactEmail: 'businessA@example.com',
        contactPhone: '+15550000001',
        timezone: 'UTC',
        status: 'ACTIVE',
      },
    });

    const businessB = await prisma.business.create({
      data: {
        name: 'Business B',
        contactEmail: 'businessB@example.com',
        contactPhone: '+15550000002',
        timezone: 'UTC',
        status: 'ACTIVE',
      },
    });

    await prisma.user.create({
      data: {
        name: 'System Owner',
        email: ownerPayload.email,
        passwordHash: await bcrypt.hash(ownerPayload.password, 10),
        role: 'SYSTEM_OWNER',
        status: 'ACTIVE',
      },
    });

    await prisma.user.create({
      data: {
        name: 'Business Admin',
        email: adminPayload.email,
        passwordHash: await bcrypt.hash(adminPayload.password, 10),
        role: 'BUSINESS_ADMIN',
        businessId: businessA.id,
        status: 'ACTIVE',
      },
    });

    const service = await prisma.service.create({
      data: {
        businessId: businessA.id,
        name: 'Consultation',
        description: '30 min consult',
        durationMinutes: 30,
        status: 'ACTIVE',
      },
    });

    const serviceB = await prisma.service.create({
      data: {
        businessId: businessB.id,
        name: 'Other Consult',
        description: 'Hidden service',
        durationMinutes: 30,
        status: 'ACTIVE',
      },
    });

    const staff = await prisma.staff.create({
      data: {
        businessId: businessA.id,
        name: 'Staff One',
        email: 'staffA@example.com',
        status: 'ACTIVE',
      },
    });

    await prisma.availability.create({
      data: {
        businessId: businessA.id,
        staffId: staff.id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        status: 'ACTIVE',
      },
    });

    await prisma.appointment.create({
      data: {
        businessId: businessA.id,
        serviceId: service.id,
        staffId: staff.id,
        customerName: 'Existing Customer',
        customerEmail: 'existing@example.com',
        customerPhone: '+15550000003',
        startAt: new Date('2026-09-07T10:00:00Z'),
        endAt: new Date('2026-09-07T10:30:00Z'),
        bookingReference: 'REF-EXISTING-1',
        status: 'CONFIRMED',
      },
    });

    await prisma.appointment.create({
      data: {
        businessId: businessB.id,
        serviceId: serviceB.id,
        staffId: null,
        customerName: 'Other Customer',
        customerEmail: 'other@example.com',
        customerPhone: '+15550000004',
        startAt: new Date('2026-09-07T10:00:00Z'),
        endAt: new Date('2026-09-07T10:30:00Z'),
        bookingReference: 'REF-B-1',
        status: 'CONFIRMED',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should require authentication for protected APIs', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('should allow a valid system owner to login', async () => {
    const response = await request(app).post('/api/auth/login').send(ownerPayload);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe(ownerPayload.email);
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('should allow a valid business admin to login', async () => {
    const response = await request(app).post('/api/auth/login').send(adminPayload);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe(adminPayload.email);
  });

  it('should block system owner endpoints for a business admin', async () => {
    const login = await request(app).post('/api/auth/login').send(adminPayload);
    const response = await request(app)
      .get('/api/businesses')
      .set(authHeader(login.body.token));

    expect(response.status).toBe(403);
  });

  it('should prevent a business admin from reading another business service', async () => {
    const login = await request(app).post('/api/auth/login').send(adminPayload);
    const serviceId = await prisma.service.findFirst({ where: { businessId: (await prisma.business.findUnique({ where: { contactEmail: 'businessB@example.com' } }))!.id } });

    const response = await request(app)
      .get(`/api/services/${serviceId!.id}`)
      .set(authHeader(login.body.token));

    expect(response.status).toBe(404);
  });

  it('should prevent a business admin from modifying another business appointment', async () => {
    const login = await request(app).post('/api/auth/login').send(adminPayload);
    const appointmentId = await prisma.appointment.findFirst({ where: { businessId: (await prisma.business.findUnique({ where: { contactEmail: 'businessB@example.com' } }))!.id } });

    const response = await request(app)
      .patch(`/api/appointments/${appointmentId!.id}/status`)
      .set(authHeader(login.body.token))
      .send({ status: 'COMPLETED' });

    expect(response.status).toBe(404);
  });

  it('should fail booking outside configured availability', async () => {
    const business = await prisma.business.findUnique({ where: { contactEmail: 'businessA@example.com' } });
    const service = await prisma.service.findFirst({ where: { businessId: business!.id } });
    const staff = await prisma.staff.findFirst({ where: { businessId: business!.id } });

    const response = await request(app)
      .post('/api/appointments')
      .send({
        businessId: business!.id,
        serviceId: service!.id,
        staffId: staff!.id,
        customerName: 'Customer A',
        customerEmail: 'customerA@example.com',
        customerPhone: '+15550000005',
        startAt: '2026-09-06T08:00:00Z',
        timezone: 'UTC',
      });

    expect(response.status).toBe(400);
  });

  it('should fail booking in the past', async () => {
    const business = await prisma.business.findUnique({ where: { contactEmail: 'businessA@example.com' } });
    const service = await prisma.service.findFirst({ where: { businessId: business!.id } });
    const staff = await prisma.staff.findFirst({ where: { businessId: business!.id } });

    const response = await request(app)
      .post('/api/appointments')
      .send({
        businessId: business!.id,
        serviceId: service!.id,
        staffId: staff!.id,
        customerName: 'Customer B',
        customerEmail: 'customerB@example.com',
        customerPhone: '+15550000006',
        startAt: '2020-09-06T10:00:00Z',
        timezone: 'UTC',
      });

    expect(response.status).toBe(400);
  });

  it('should fail if the service is inactive', async () => {
    const business = await prisma.business.findUnique({ where: { contactEmail: 'businessA@example.com' } });
    const staff = await prisma.staff.findFirst({ where: { businessId: business!.id } });

    const service = await prisma.service.create({
      data: {
        businessId: business!.id,
        name: 'Inactive Service',
        description: 'off',
        durationMinutes: 30,
        status: 'INACTIVE',
      },
    });

    const response = await request(app)
      .post('/api/appointments')
      .send({
        businessId: business!.id,
        serviceId: service.id,
        staffId: staff!.id,
        customerName: 'Customer C',
        customerEmail: 'customerC@example.com',
        customerPhone: '+15550000007',
        startAt: '2026-09-06T10:00:00Z',
        timezone: 'UTC',
      });

    expect(response.status).toBe(400);
  });

  it('should fail when business is disabled', async () => {
    const business = await prisma.business.create({
      data: {
        name: 'Disabled Business',
        contactEmail: 'disabled@example.com',
        contactPhone: '+15550000008',
        timezone: 'UTC',
        status: 'DISABLED',
      },
    });

    const service = await prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Disabled business service',
        description: 'disabled',
        durationMinutes: 30,
        status: 'ACTIVE',
      },
    });

    const response = await request(app)
      .post('/api/appointments')
      .send({
        businessId: business.id,
        serviceId: service.id,
        customerName: 'Customer D',
        customerEmail: 'customerD@example.com',
        customerPhone: '+15550000009',
        startAt: '2026-09-06T10:00:00Z',
        timezone: 'UTC',
      });

    expect(response.status).toBe(400);
  });

  it('should detect a double booking conflict', async () => {
    const business = await prisma.business.findUnique({ where: { contactEmail: 'businessA@example.com' } });
    const service = await prisma.service.findFirst({ where: { businessId: business!.id } });
    const staff = await prisma.staff.findFirst({ where: { businessId: business!.id } });

    const response = await request(app)
      .post('/api/appointments')
      .send({
        businessId: business!.id,
        serviceId: service!.id,
        staffId: staff!.id,
        customerName: 'Double Booking Customer',
        customerEmail: 'double@example.com',
        customerPhone: '+15550000010',
        startAt: '2026-09-07T10:00:00Z',
        timezone: 'UTC',
      });

    expect(response.status).toBe(409);
  });

  it('should detect overlap conflicts', async () => {
    const business = await prisma.business.findUnique({ where: { contactEmail: 'businessA@example.com' } });
    const service = await prisma.service.findFirst({ where: { businessId: business!.id } });
    const staff = await prisma.staff.findFirst({ where: { businessId: business!.id } });

    const response = await request(app)
      .post('/api/appointments')
      .send({
        businessId: business!.id,
        serviceId: service!.id,
        staffId: staff!.id,
        customerName: 'Overlap Customer',
        customerEmail: 'overlap@example.com',
        customerPhone: '+15550000011',
        startAt: '2026-09-07T10:15:00Z',
        timezone: 'UTC',
      });

    expect(response.status).toBe(409);
  });

  it('should allow a cancelled appointment to stop blocking a slot', async () => {
    const business = await prisma.business.findUnique({ where: { contactEmail: 'businessA@example.com' } });
    const service = await prisma.service.findFirst({ where: { businessId: business!.id } });
    const staff = await prisma.staff.findFirst({ where: { businessId: business!.id } });

    const cancelled = await prisma.appointment.create({
      data: {
        businessId: business!.id,
        serviceId: service!.id,
        staffId: staff!.id,
        customerName: 'Cancelled Customer',
        customerEmail: 'cancelled@example.com',
        customerPhone: '+15550000012',
        startAt: new Date('2026-09-07T11:00:00Z'),
        endAt: new Date('2026-09-07T11:30:00Z'),
        bookingReference: 'REF-CANCELLED-1',
        status: 'CANCELLED',
      },
    });

    await prisma.appointment.update({
      where: { id: cancelled.id },
      data: { status: 'CANCELLED' },
    });

    const response = await request(app)
      .post('/api/appointments')
      .send({
        businessId: business!.id,
        serviceId: service!.id,
        staffId: staff!.id,
        customerName: 'Next Customer',
        customerEmail: 'next@example.com',
        customerPhone: '+15550000013',
        startAt: '2026-09-07T11:00:00Z',
        timezone: 'UTC',
      });

    expect(response.status).toBe(201);
  });
});
