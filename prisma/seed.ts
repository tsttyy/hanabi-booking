import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const ownerPasswordHash = await bcrypt.hash('Owner@12345', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@12345', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: { name: 'System Owner', passwordHash: ownerPasswordHash, role: 'SYSTEM_OWNER', status: 'ACTIVE' },
    create: {
      id: randomUUID(),
      name: 'System Owner',
      email: 'owner@example.com',
      passwordHash: ownerPasswordHash,
      role: 'SYSTEM_OWNER',
      status: 'ACTIVE',
    },
  });

  const business = await prisma.business.upsert({
    where: { contactEmail: 'hello@demobusiness.com' },
    update: { name: 'Demo Business', contactPhone: '+91-9876543210', timezone: 'Asia/Kolkata', status: 'ACTIVE' },
    create: {
      id: randomUUID(),
      name: 'Demo Business',
      contactEmail: 'hello@demobusiness.com',
      contactPhone: '+91-9876543210',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { name: 'Demo Admin', passwordHash: adminPasswordHash, role: 'BUSINESS_ADMIN', status: 'ACTIVE', businessId: business.id },
    create: {
      id: randomUUID(),
      name: 'Demo Admin',
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      role: 'BUSINESS_ADMIN',
      status: 'ACTIVE',
      businessId: business.id,
    },
  });

  await prisma.user.updateMany({
    where: { id: { in: [owner.id, admin.id] }, businessId: { not: null } },
    data: { businessId: null },
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { businessId: business.id },
  });

  const services = [
    {
      businessId: business.id,
      name: 'Consultation',
      description: '30-minute consultation',
      durationMinutes: 30,
      status: 'ACTIVE',
    },
    {
      businessId: business.id,
      name: 'Strategy Session',
      description: '60-minute strategy session',
      durationMinutes: 60,
      status: 'ACTIVE',
    },
  ] as const;

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: (await prisma.service.findFirst({ where: { businessId: business.id, name: service.name } }))?.id ?? randomUUID() },
      update: { ...service },
      create: { id: randomUUID(), ...service },
    });
  }

  const staffList = [
    { businessId: business.id, name: 'Aditi Sharma', email: 'aditi@demobusiness.com', status: 'ACTIVE' },
    { businessId: business.id, name: 'Rahul Mehta', email: 'rahul@demobusiness.com', status: 'ACTIVE' },
  ] as const;

  for (const member of staffList) {
    await prisma.staff.upsert({
      where: { businessId_email: { businessId: member.businessId, email: member.email } },
      update: { ...member },
      create: { id: randomUUID(), ...member },
    });
  }

  const staff = await prisma.staff.findMany({ where: { businessId: business.id } });
  const days = [1, 2, 3, 4, 5];

  for (const person of staff) {
    for (const dayOfWeek of days) {
      const start = dayOfWeek === 5 ? '09:00' : '09:30';
      const end = dayOfWeek === 5 ? '17:00' : '18:00';
      await prisma.availability.create({
        data: {
          id: randomUUID(),
          businessId: business.id,
          staffId: person.id,
          dayOfWeek,
          startTime: start,
          endTime: end,
          status: 'ACTIVE',
        },
      });
    }
  }

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
