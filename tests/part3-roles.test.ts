import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();

describe('Part 3 Roles & Authorization', () => {
  let ownerToken: string;
  let adminAToken: string;
  let adminBToken: string;
  let businessAId: string;
  let businessBId: string;
  let serviceAId: string;

  it('18. System Owner Login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@example.com', password: 'Owner@12345' });
    expect(response.status).toBe(200);
    ownerToken = response.headers['set-cookie'][0].split(';')[0].split('=')[1];
  });

  it('20. System Owner Create business with admin', async () => {
    const response = await request(app)
      .post('/api/businesses')
      .set('Cookie', `token=${ownerToken}`)
      .send({
        name: 'Business A',
        contactEmail: 'biza@example.com',
        contactPhone: '+1000000000',
        timezone: 'UTC',
        status: 'ACTIVE',
        adminName: 'Admin A',
        adminEmail: 'adminA@example.com',
        adminPassword: 'Password@123',
      });
    expect(response.status).toBe(201);
    businessAId = response.body.business.id;
  });

  it('20b. System Owner Create another business with admin', async () => {
    const response = await request(app)
      .post('/api/businesses')
      .set('Cookie', `token=${ownerToken}`)
      .send({
        name: 'Business B',
        contactEmail: 'bizb@example.com',
        contactPhone: '+1000000000',
        timezone: 'UTC',
        status: 'ACTIVE',
        adminName: 'Admin B',
        adminEmail: 'adminB@example.com',
        adminPassword: 'Password@123',
      });
    expect(response.status).toBe(201);
    businessBId = response.body.business.id;
  });

  it('19. System Owner Business list', async () => {
    const response = await request(app)
      .get('/api/businesses')
      .set('Cookie', `token=${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.businesses.length).toBeGreaterThanOrEqual(2);
  });

  it('21. System Owner Enable business / 22. Disable business', async () => {
    const disableRes = await request(app)
      .patch(`/api/businesses/${businessAId}/status`)
      .set('Cookie', `token=${ownerToken}`)
      .send({ status: 'DISABLED' });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.business.status).toBe('DISABLED');

    const enableRes = await request(app)
      .patch(`/api/businesses/${businessAId}/status`)
      .set('Cookie', `token=${ownerToken}`)
      .send({ status: 'ACTIVE' });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.business.status).toBe('ACTIVE');
  });

  it('11. Business Admin Login (Tenant A)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'adminA@example.com', password: 'Password@123' });
    expect(response.status).toBe(200);
    adminAToken = response.headers['set-cookie'][0].split(';')[0].split('=')[1];
  });

  it('11b. Business Admin Login (Tenant B)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'adminB@example.com', password: 'Password@123' });
    expect(response.status).toBe(200);
    adminBToken = response.headers['set-cookie'][0].split(';')[0].split('=')[1];
  });

  it('13. Business Admin Profile', async () => {
    const response = await request(app)
      .get('/api/business/profile')
      .set('Cookie', `token=${adminAToken}`);
    expect(response.status).toBe(200);
    expect(response.body.business.id).toBe(businessAId);
  });

  it('14. Services CRUD', async () => {
    const createRes = await request(app)
      .post('/api/services')
      .set('Cookie', `token=${adminAToken}`)
      .send({ name: 'Service A', durationMinutes: 60 });
    expect(createRes.status).toBe(201);
    serviceAId = createRes.body.service.id;

    const listRes = await request(app)
      .get('/api/services')
      .set('Cookie', `token=${adminAToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.services.some((s: any) => s.id === serviceAId)).toBe(true);
  });

  it('15. Staff CRUD', async () => {
    const createRes = await request(app)
      .post('/api/staff')
      .set('Cookie', `token=${adminAToken}`)
      .send({ name: 'Staff A', email: 'staffA@example.com' });
    expect(createRes.status).toBe(201);
  });

  it('25. Business Admin tenant isolation', async () => {
    // Admin B should not see Admin A's services
    const listRes = await request(app)
      .get('/api/services')
      .set('Cookie', `token=${adminBToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.services.some((s: any) => s.id === serviceAId)).toBe(false);

    // Admin B cannot update Admin A's service
    const updateRes = await request(app)
      .patch(`/api/services/${serviceAId}`)
      .set('Cookie', `token=${adminBToken}`)
      .send({ name: 'Hacked' });
    expect(updateRes.status).toBe(404); // Not found because it checks businessId
  });

  it('24. Business Admin blocked from owner API', async () => {
    const response = await request(app)
      .get('/api/businesses')
      .set('Cookie', `token=${adminAToken}`);
    expect(response.status).toBe(403);
  });

  it('25b. Customer token cannot access business admin APIs', async () => {
    const signup = await request(app)
      .post('/api/customer/auth/signup')
      .send({
        name: 'Role Check Customer',
        email: `rolecheck_${Date.now()}@example.com`,
        password: 'Password@12345',
      });
    expect(signup.status).toBe(201);

    const response = await request(app)
      .get('/api/services')
      .set('Authorization', `Bearer ${signup.body.token}`);
    expect(response.status).toBe(401);
  });

  it('26. Unauthenticated protected API rejected', async () => {
    const response = await request(app).get('/api/services');
    expect(response.status).toBe(401);
  });

  it('28. Admin Logout', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `token=${adminAToken}`);
    expect(response.status).toBe(200);
  });
});
