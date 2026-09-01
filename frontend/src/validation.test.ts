import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const login = z.object({ email: z.string().email(), password: z.string().min(8) });
const booking = z.object({ customerName: z.string().min(1), customerEmail: z.string().email(), customerPhone: z.string().min(7) });
const customerSignup = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8), phone: z.string().optional() });
const passwordChange = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8), confirmPassword: z.string() })
  .refine((data) => data.newPassword === data.confirmPassword, { path: ['confirmPassword'] });

describe('client validation', () => {
  it('rejects an invalid login form', () => expect(login.safeParse({ email: 'no', password: 'short' }).success).toBe(false));
  it('accepts internal login input', () => expect(login.safeParse({ email: 'admin@example.com', password: 'Admin@12345' }).success).toBe(true));
  it('rejects incomplete booking details', () => expect(booking.safeParse({ customerName: '', customerEmail: 'x', customerPhone: '1' }).success).toBe(false));
  it('accepts booking details', () => expect(booking.safeParse({ customerName: 'A', customerEmail: 'a@example.com', customerPhone: '+919876543210' }).success).toBe(true));
  it('rejects invalid customer signup', () => expect(customerSignup.safeParse({ name: '', email: 'invalid', password: '123' }).success).toBe(false));
  it('accepts valid customer signup', () => expect(customerSignup.safeParse({ name: 'John', email: 'john@example.com', password: 'Password123' }).success).toBe(true));
  it('rejects password change mismatch', () => expect(passwordChange.safeParse({ currentPassword: 'old', newPassword: 'newpassword123', confirmPassword: 'differentpassword' }).success).toBe(false));
  it('accepts valid password change', () => expect(passwordChange.safeParse({ currentPassword: 'old', newPassword: 'newpassword123', confirmPassword: 'newpassword123' }).success).toBe(true));
});
