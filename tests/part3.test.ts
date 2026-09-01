import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import bcrypt from 'bcryptjs';

const app = createApp();

describe('Part 3 Customer & Security Audit', () => {
  let customerToken: string;
  let customerCookie: string;
  let customerId: string;
  let businessId: string;
  let serviceId: string;
  let appointmentId: string;
  const customerEmail = `customer_${Date.now()}@example.com`;

  beforeAll(async () => {
    // Create a demo business & active service for customer testing
    const business = await prisma.business.create({
      data: {
        name: 'Part 3 Test Business',
        contactEmail: `p3biz_${Date.now()}@example.com`,
        contactPhone: '+15559990001',
        timezone: 'UTC',
        status: 'ACTIVE',
      },
    });
    businessId = business.id;

    const service = await prisma.service.create({
      data: {
        businessId: business.id,
        name: 'Customer Test Service',
        description: 'Customer test',
        durationMinutes: 30,
        status: 'ACTIVE',
      },
    });
    serviceId = service.id;

    // Set availability
    await prisma.availability.create({
      data: {
        businessId: business.id,
        dayOfWeek: 1,
        startTime: '00:00',
        endTime: '23:59',
        status: 'ACTIVE',
      },
    });
  });

  it('1. should allow a customer to sign up', async () => {
    const response = await request(app)
      .post('/api/customer/auth/signup')
      .send({
        name: 'Jane Customer',
        email: customerEmail,
        password: 'Password@12345',
        phone: '+15551234567',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.customer.email).toBe(customerEmail);
    expect(response.body.customer.passwordHash).toBeUndefined();
    expect(response.body.token).toBeDefined();

    customerToken = response.body.token;
    customerCookie = response.headers['set-cookie'][0];
    customerId = response.body.customer.id;
  });

  it('2. should reject duplicate customer email during signup', async () => {
    const response = await request(app)
      .post('/api/customer/auth/signup')
      .send({
        name: 'Duplicate Customer',
        email: customerEmail,
        password: 'Password@12345',
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it('3. should allow customer to log in', async () => {
    const response = await request(app)
      .post('/api/customer/auth/login')
      .send({
        email: customerEmail,
        password: 'Password@12345',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.customer.email).toBe(customerEmail);
    expect(response.body.customer.passwordHash).toBeUndefined();
  });

  it('4. should reject invalid customer credentials', async () => {
    const response = await request(app)
      .post('/api/customer/auth/login')
      .send({
        email: customerEmail,
        password: 'WrongPassword',
      });

    expect(response.status).toBe(401);
  });

  it('5. should return customer profile for /api/customer/auth/me', async () => {
    const response = await request(app)
      .get('/api/customer/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.customer.id).toBe(customerId);
    expect(response.body.customer.passwordHash).toBeUndefined();
  });

  it('6. should allow customer to update profile', async () => {
    const response = await request(app)
      .patch('/api/customer/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Jane Updated',
        phone: '+15559876543',
      });

    expect(response.status).toBe(200);
    expect(response.body.customer.name).toBe('Jane Updated');
    expect(response.body.customer.phone).toBe('+15559876543');
  });

  it('7. should allow customer to change password', async () => {
    const response = await request(app)
      .patch('/api/customer/password')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        currentPassword: 'Password@12345',
        newPassword: 'NewPassword@12345',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Re-verify login with new password
    const relogin = await request(app)
      .post('/api/customer/auth/login')
      .send({
        email: customerEmail,
        password: 'NewPassword@12345',
      });

    expect(relogin.status).toBe(200);
  });

  it('8. should automatically link appointment when customer books', async () => {
    // Pick future date
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + ((1 + 7 - d.getUTCDay()) % 7 || 7));
    d.setUTCHours(14, 0, 0, 0);

    const bookingRes = await request(app)
      .post('/api/appointments')
      .send({
        businessId,
        serviceId,
        customerName: 'Jane Updated',
        customerEmail: customerEmail,
        customerPhone: '+15559876543',
        startAt: d.toISOString(),
      });

    expect(bookingRes.status).toBe(201);
    expect(bookingRes.body.appointment.bookingReference).toBeDefined();
    appointmentId = bookingRes.body.appointment.id;
  });

  it('9. should list appointments for logged-in customer', async () => {
    const response = await request(app)
      .get('/api/customer/appointments')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.appointments.length).toBeGreaterThan(0);
    expect(response.body.appointments[0].id).toBe(appointmentId);
  });

  it('10. should view appointment details for logged-in customer', async () => {
    const response = await request(app)
      .get(`/api/customer/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.appointment.id).toBe(appointmentId);
  });

  it('11. should allow customer to cancel eligible appointment', async () => {
    const response = await request(app)
      .patch(`/api/customer/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.appointment.status).toBe('CANCELLED');
  });

  it('12. should prevent customer from cancelling an already cancelled appointment', async () => {
    const response = await request(app)
      .patch(`/api/customer/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(400);
  });

  it('12b. should list only active businesses for public browsing', async () => {
    const response = await request(app).get('/api/public/businesses');
    expect(response.status).toBe(200);
    expect(response.body.businesses.some((b: { id: string }) => b.id === businessId)).toBe(true);
    expect(response.body.businesses.every((b: { status?: string }) => b.status === undefined)).toBe(true);
  });

  it('13. should clear customer session on logout', async () => {
    const response = await request(app)
      .post('/api/customer/auth/logout')
      .set('Cookie', customerCookie);

    expect(response.status).toBe(200);
  });
});
