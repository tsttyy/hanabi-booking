declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        businessId: string | null;
        email: string;
        role: 'SYSTEM_OWNER' | 'BUSINESS_ADMIN';
        status: 'ACTIVE' | 'DISABLED';
      };
      businessId?: string;
    }
  }
}

export {};
