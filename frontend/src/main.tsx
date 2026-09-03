// @ts-nocheck
import { createRoot } from 'react-dom/client';
import { FormEvent, ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import './styles.css';

type Role = 'SYSTEM_OWNER' | 'BUSINESS_ADMIN';
type User = { id: string; name: string; email: string; role: Role; businessId: string | null };
type Customer = { id: string; name: string; email: string; phone: string | null; status: string };
type Business = { id: string; name: string; contactEmail: string; contactPhone: string; timezone: string; status: 'ACTIVE' | 'DISABLED' };
type Service = { id: string; name: string; description: string | null; durationMinutes: number; status: 'ACTIVE' | 'INACTIVE' };
type Staff = { id: string; name: string; email: string; status: 'ACTIVE' | 'DISABLED' };
type Availability = { id: string; staffId: string | null; dayOfWeek: number; startTime: string; endTime: string; status: 'ACTIVE' | 'DISABLED' };
type Appointment = {
  id: string;
  bookingReference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startAt: string;
  endAt: string;
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  service: Service;
  staff: Staff | null;
};
type CustomerAppointment = Appointment & { business: { id: string; name: string; timezone: string } };

class ApiError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

// Empty in development: Vite proxies same-origin /api requests to the local API.
// In production, set VITE_API_BASE_URL to the deployed API's /api URL.
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const apiUrl = (path: string) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(apiUrl(url), { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  } catch {
    throw new ApiError(0, 'Unable to connect to the booking server');
  }
  const b = await r.json().catch(() => ({}));
  if (!r.ok || b.success === false) throw new ApiError(r.status, b.error?.message || 'Request failed');
  return b as T;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return call<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

function patch<T>(url: string, body: unknown): Promise<T> {
  return call<T>(url, { method: 'PATCH', body: JSON.stringify(body) });
}

const api = {
  // Admin & Owner Auth
  login: (email: string, password: string) => post<{ user: User }>('/api/auth/login', { email, password }),
  me: () => call<{ user: User }>('/api/auth/me'),
  logout: () => post('/api/auth/logout', {}),

  // Customer Auth
  customerSignup: (x: unknown) => post<{ customer: Customer; token: string }>('/api/customer/auth/signup', x),
  customerLogin: (email: string, password: string) => post<{ customer: Customer; token: string }>('/api/customer/auth/login', { email, password }),
  customerMe: () => call<{ customer: Customer }>('/api/customer/auth/me'),
  customerLogout: () => post('/api/customer/auth/logout', {}),

  // Customer Profile & Appointments
  customerProfile: () => call<{ customer: Customer }>('/api/customer/profile'),
  customerUpdateProfile: (x: unknown) => patch<{ customer: Customer }>('/api/customer/profile', x),
  customerChangePassword: (x: unknown) => patch<{ message: string }>('/api/customer/password', x),
  customerAppointments: () => call<{ appointments: CustomerAppointment[] }>('/api/customer/appointments'),
  customerAppointmentDetail: (id: string) => call<{ appointment: CustomerAppointment }>(`/api/customer/appointments/${id}`),
  customerCancelAppointment: (id: string) => patch<{ appointment: CustomerAppointment }>(`/api/customer/appointments/${id}/cancel`, {}),

  // Admin APIs
  businesses: () => call<{ businesses: Business[] }>('/api/businesses'),
  createBusiness: (x: unknown) => post('/api/businesses', x),
  businessStatus: (id: string, status: string) => patch(`/api/businesses/${id}/status`, { status }),
  profile: () => call<{ business: Business }>('/api/business/profile'),
  updateProfile: (x: unknown) => patch('/api/business/profile', x),
  services: () => call<{ services: Service[] }>('/api/services'),
  staff: () => call<{ staff: Staff[] }>('/api/staff'),
  availability: () => call<{ availability: Availability[] }>('/api/availability'),
  appointments: () => call<{ appointments: Appointment[] }>('/api/appointments'),
  createService: (x: unknown) => post('/api/services', x),
  createStaff: (x: unknown) => post('/api/staff', x),
  createAvailability: (x: unknown) => post('/api/availability', x),
  delete: (x: string) => call(x, { method: 'DELETE' }),

  // Public Booking APIs
  bookingBusinesses: () => call<{ businesses: Business[] }>('/api/public/businesses'),
  bookingBusiness: (id: string) => call<{ business: Business }>(`/api/public/businesses/${id}`),
  bookingServices: (id: string) => call<{ services: Service[] }>(`/api/public/businesses/${id}/services`),
  bookingStaff: (id: string) => call<{ staff: Staff[] }>(`/api/public/businesses/${id}/staff`),
  slots: (b: string, s: string, date: string, staff?: string) =>
    call<{ slots: string[] }>(`/api/public/businesses/${b}/services/${s}/slots?date=${date}${staff ? `&staffId=${staff}` : ''}`),
  book: (x: unknown) => post<{ appointment: Appointment }>('/api/appointments', x),
  lookup: (reference: string, email: string) =>
    call<{ appointment: Appointment & { business: Business } }>(`/api/public/bookings?reference=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`),
  cancel: (reference: string, email: string) => post('/api/public/bookings/cancel', { reference, email }),
};

const Auth = createContext<{
  user: User | null;
  customer: Customer | null;
  ready: boolean;
  setUser: (x: User | null) => void;
  setCustomer: (x: Customer | null) => void;
}>({
  user: null,
  customer: null,
  ready: false,
  setUser: () => {},
  setCustomer: () => {},
});

const useAuth = () => useContext(Auth);

function Provider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      api.me().then((x) => setUser(x.user)).catch(() => {}),
      api.customerMe().then((x) => setCustomer(x.customer)).catch(() => {}),
    ]).finally(() => setReady(true));
  }, []);

  return (
    <Auth.Provider value={{ user, customer, ready, setUser, setCustomer }}>
      {children}
    </Auth.Provider>
  );
}

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

function Guard({ children, role }: { children: ReactNode; role?: Role }) {
  const a = useAuth();
  if (!a.ready) return <p>Loading…</p>;
  if (!a.user) return <Navigate to="/login" />;
  if (role && a.user.role !== role) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function CustomerGuard({ children }: { children: ReactNode }) {
  const a = useAuth();
  if (!a.ready) return <p>Loading…</p>;
  if (!a.customer) return <Navigate to="/customer/login" />;
  return <>{children}</>;
}

function Login() {
  const a = useAuth(),
    n = useNavigate(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);

  if (a.user) return <Navigate to="/dashboard" />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const v = z
      .object({
        email: z.string().email('Enter a valid email.'),
        password: z.string().min(8, 'Password must be at least 8 characters.'),
      })
      .safeParse(d);

    if (!v.success) {
      setError(v.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const r = await api.login(v.data.email, v.data.password);
      a.setUser(r.user);
      n('/dashboard');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section>
        <small>HANABI TECHNOLOGIES</small>
        <h1>Admin Sign in</h1>
        <p>System Owner and Business Admin access only.</p>
        {error && <p className="alert">{error}</p>}
        <form onSubmit={submit}>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: '#68738a' }}>
          <p style={{ marginBottom: '0.5rem' }}>
            Customers can create an account using <Link to="/customer/signup">Customer Signup</Link>
            {' '}or <Link to="/customer/login">Customer Sign in</Link>.
          </p>
          <p style={{ fontSize: '0.85rem' }}>
            Business Admin accounts are provisioned by the System Owner and do not use public signup.
          </p>
        </div>
      </section>
    </main>
  );
}

function CustomerSignup() {
  const a = useAuth(),
    n = useNavigate(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);

  if (a.customer) return <Navigate to="/customer/dashboard" />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const v = z
      .object({
        name: z.string().min(1, 'Name is required.'),
        email: z.string().email('Enter a valid email address.'),
        password: z.string().min(8, 'Password must be at least 8 characters.'),
        phone: z.string().optional(),
      })
      .safeParse(d);

    if (!v.success) {
      setError(v.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const r = await api.customerSignup({
        name: v.data.name,
        email: v.data.email,
        password: v.data.password,
        phone: v.data.phone || undefined,
      });
      a.setCustomer(r.customer);
      n('/customer/dashboard');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section>
        <small>HANABI BOOKING</small>
        <h1>Create Customer Account</h1>
        <p>Sign up to view and manage your bookings.</p>
        {error && <p className="alert">{error}</p>}
        <form onSubmit={submit}>
          <label>
            Full Name
            <input name="name" type="text" required placeholder="John Doe" />
          </label>
          <label>
            Email
            <input name="email" type="email" required placeholder="john@example.com" />
          </label>
          <label>
            Password
            <input name="password" type="password" required placeholder="Minimum 8 characters" />
          </label>
          <label>
            Phone (optional)
            <input name="phone" type="tel" placeholder="+1 234 567 8900" />
          </label>
          <button disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
        </form>
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
          Already have an account? <Link to="/customer/login">Customer Sign in</Link>
        </p>
      </section>
    </main>
  );
}

function CustomerLogin() {
  const a = useAuth(),
    n = useNavigate(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);

  if (a.customer) return <Navigate to="/customer/dashboard" />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const v = z
      .object({
        email: z.string().email('Enter a valid email.'),
        password: z.string().min(1, 'Password is required.'),
      })
      .safeParse(d);

    if (!v.success) {
      setError(v.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const r = await api.customerLogin(v.data.email, v.data.password);
      a.setCustomer(r.customer);
      n('/customer/dashboard');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section>
        <small>HANABI BOOKING</small>
        <h1>Customer Sign in</h1>
        <p>Access your appointments and personal profile.</p>
        {error && <p className="alert">{error}</p>}
        <form onSubmit={submit}>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
          Don't have an account? <Link to="/customer/signup">Create account / Sign up</Link>
        </p>
        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#68738a' }}>
          Are you a business owner or admin? <Link to="/login">Business Sign in</Link>
        </p>
      </section>
    </main>
  );
}

function CustomerShell({ children }: { children: ReactNode }) {
  const a = useAuth(),
    n = useNavigate();
  const links = [
    ['Dashboard', '/customer/dashboard'],
    ['My Appointments', '/customer/appointments'],
    ['Profile & Security', '/customer/profile'],
  ];

  return (
    <div className="shell">
      <aside>
        <Link className="brand" to="/customer/dashboard">
          hanabi<span>customer</span>
        </Link>
        <nav>
          {links.map(([t, u]) => (
            <Link to={u} key={u}>
              {t}
            </Link>
          ))}
        </nav>
        <small>{a.customer?.email}</small>
        <button
          className="text"
          onClick={() =>
            api.customerLogout().finally(() => {
              a.setCustomer(null);
              n('/customer/login');
            })
          }
        >
          Log out
        </button>
      </aside>
      <main>{children}</main>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const a = useAuth(),
    n = useNavigate();
  const links =
    a.user?.role === 'SYSTEM_OWNER'
      ? [
          ['Overview', '/dashboard'],
          ['Businesses', '/admin'],
        ]
      : [
          ['Dashboard', '/dashboard'],
          ['Business', '/business'],
          ['Services', '/services'],
          ['Staff', '/staff'],
          ['Availability', '/availability'],
          ['Appointments', '/appointments'],
        ];
  return (
    <div className="shell">
      <aside>
        <Link className="brand" to="/dashboard">
          hanabi<span>booking</span>
        </Link>
        <nav>
          {links.map(([t, u]) => (
            <Link to={u} key={u}>
              {t}
            </Link>
          ))}
        </nav>
        <small>{a.user?.email}</small>
        <button
          className="text"
          onClick={() =>
            api.logout().finally(() => {
              a.setUser(null);
              n('/login');
            })
          }
        >
          Log out
        </button>
      </aside>
      <main>{children}</main>
    </div>
  );
}

function Page({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <>
      <header>
        <div>
          <h1>{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </>
  );
}

const Badge = ({ x }: { x: string }) => <span className={`badge ${x === 'ACTIVE' || x === 'CONFIRMED' ? 'ok' : ''}`}>{x}</span>;

function Dashboard() {
  const a = useAuth();
  return a.user?.role === 'SYSTEM_OWNER' ? <Businesses /> : <AdminDashboard />;
}

function AdminDashboard() {
  const [stats, setStats] = useState<number[] | null>(null);
  useEffect(() => {
    Promise.all([api.services(), api.staff(), api.appointments()]).then(([s, t, a]) =>
      setStats([
        s.services.filter((x) => x.status === 'ACTIVE').length,
        t.staff.length,
        a.appointments.filter((x) => new Date(x.startAt) > new Date()).length,
        a.appointments.filter((x) => new Date(x.startAt).toDateString() === new Date().toDateString()).length,
      ])
    );
  }, []);
  return (
    <Page title="Dashboard">
      {!stats ? (
        <p>Loading dashboard…</p>
      ) : (
        <div className="stats">
          {['Active services', 'Team members', 'Upcoming', 'Today'].map((x, i) => (
            <article key={x}>
              <strong>{stats[i]}</strong>
              <span>{x}</span>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}

function CustomerDashboard() {
  const a = useAuth();
  const [apts, setApts] = useState<CustomerAppointment[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .customerAppointments()
      .then((x) => setApts(x.appointments))
      .catch((e) => setError(message(e)));
  }, []);

  if (!apts) return <p>Loading customer dashboard…</p>;

  const upcoming = apts.filter((x) => new Date(x.startAt) >= new Date() && x.status !== 'CANCELLED');
  const pastOrCancelled = apts.filter((x) => new Date(x.startAt) < new Date() || x.status === 'CANCELLED');

  return (
    <Page
      title={`Welcome, ${a.customer?.name || 'Customer'}`}
      action={
        <Link to="/book">
          <button>Find a business to book</button>
        </Link>
      }
    >
      {error && <p className="alert">{error}</p>}
      <div className="stats">
        <article>
          <strong>{apts.length}</strong>
          <span>Total Bookings</span>
        </article>
        <article>
          <strong>{upcoming.length}</strong>
          <span>Upcoming Appointments</span>
        </article>
      </div>

      <section style={{ marginTop: '2rem' }}>
        <h2>Upcoming Appointments</h2>
        <div className="rows">
          {upcoming.length === 0 ? (
            <p>No upcoming appointments found.</p>
          ) : (
            upcoming.map((x) => (
              <article className="row" key={x.id}>
                <div>
                  <strong>{x.service.name}</strong> with {x.business.name}
                  <br />
                  <small>
                    {new Date(x.startAt).toLocaleString()} ({x.business.timezone}) · Ref: {x.bookingReference}
                    {x.staff ? ` · Staff: ${x.staff.name}` : ''}
                  </small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge x={x.status} />
                  <Link to={`/customer/appointments/${x.id}`}>
                    <button className="secondary">Details</button>
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Recent & Past Appointments</h2>
        <div className="rows">
          {pastOrCancelled.length === 0 ? (
            <p>No past appointments found.</p>
          ) : (
            pastOrCancelled.slice(0, 5).map((x) => (
              <article className="row" key={x.id}>
                <div>
                  <strong>{x.service.name}</strong> with {x.business.name}
                  <br />
                  <small>
                    {new Date(x.startAt).toLocaleString()} · Ref: {x.bookingReference}
                  </small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge x={x.status} />
                  <Link to={`/customer/appointments/${x.id}`}>
                    <button className="secondary">Details</button>
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </Page>
  );
}

function CustomerProfilePage() {
  const a = useAuth();
  const [profileNote, setProfileNote] = useState('');
  const [passwordNote, setPasswordNote] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyPassword, setBusyPassword] = useState(false);

  const [customer, setCustomer] = useState<Customer | null>(a.customer);

  useEffect(() => {
    api
      .customerProfile()
      .then((x) => {
        setCustomer(x.customer);
        a.setCustomer(x.customer);
      })
      .catch(() => {});
  }, []);

  if (!customer) return <p>Loading profile…</p>;

  async function handleUpdateProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileNote('');
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const v = z
      .object({
        name: z.string().min(1, 'Name cannot be empty.'),
        phone: z.string().optional(),
      })
      .safeParse(d);

    if (!v.success) {
      setProfileNote(v.error.issues[0].message);
      return;
    }

    setBusyProfile(true);
    try {
      const res = await api.customerUpdateProfile({
        name: v.data.name,
        phone: v.data.phone || null,
      });
      setCustomer(res.customer);
      a.setCustomer(res.customer);
      setProfileNote('Profile saved successfully.');
    } catch (err) {
      setProfileNote(message(err));
    } finally {
      setBusyProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordNote('');
    setPasswordError('');
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form));

    const v = z
      .object({
        currentPassword: z.string().min(1, 'Current password is required.'),
        newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
        confirmPassword: z.string(),
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'New password and confirmation do not match.',
        path: ['confirmPassword'],
      })
      .safeParse(d);

    if (!v.success) {
      setPasswordError(v.error.issues[0].message);
      return;
    }

    setBusyPassword(true);
    try {
      const res = await api.customerChangePassword({
        currentPassword: v.data.currentPassword,
        newPassword: v.data.newPassword,
      });
      setPasswordNote(res.message || 'Password changed successfully.');
      form.reset();
    } catch (err) {
      setPasswordError(message(err));
    } finally {
      setBusyPassword(false);
    }
  }

  return (
    <Page title="Profile & Security">
      <section className="card">
        <h2>Personal Information</h2>
        {profileNote && <p className={profileNote.includes('saved') ? 'oktext' : 'alert'}>{profileNote}</p>}
        <form className="grid" onSubmit={handleUpdateProfile}>
          <label>
            Name
            <input name="name" defaultValue={customer.name} required />
          </label>
          <label>
            Email (read-only)
            <input name="email" value={customer.email} disabled style={{ backgroundColor: '#f0f2f5' }} />
          </label>
          <label>
            Phone
            <input name="phone" defaultValue={customer.phone || ''} placeholder="+1 234 567 8900" />
          </label>
          <div style={{ gridColumn: 'span 2' }}>
            <button disabled={busyProfile}>{busyProfile ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </section>

      <section className="card" style={{ marginTop: '2rem' }}>
        <h2>Change Password</h2>
        {passwordNote && <p className="oktext">{passwordNote}</p>}
        {passwordError && <p className="alert">{passwordError}</p>}
        <form className="grid" onSubmit={handleChangePassword}>
          <label style={{ gridColumn: 'span 2' }}>
            Current Password
            <input name="currentPassword" type="password" required />
          </label>
          <label>
            New Password
            <input name="newPassword" type="password" required placeholder="Minimum 8 characters" />
          </label>
          <label>
            Confirm New Password
            <input name="confirmPassword" type="password" required />
          </label>
          <div style={{ gridColumn: 'span 2' }}>
            <button disabled={busyPassword}>{busyPassword ? 'Updating Password…' : 'Update Password'}</button>
          </div>
        </form>
      </section>
    </Page>
  );
}

function CustomerAppointmentsPage() {
  const [apts, setApts] = useState<CustomerAppointment[] | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const load = () => {
    api
      .customerAppointments()
      .then((x) => setApts(x.appointments))
      .catch((e) => setError(message(e)));
  };

  useEffect(() => {
    load();
  }, []);

  if (!apts) return <p>Loading appointments…</p>;

  const filtered = apts.filter((x) => {
    if (filter === 'UPCOMING') return new Date(x.startAt) >= new Date() && x.status !== 'CANCELLED';
    if (filter === 'PAST') return new Date(x.startAt) < new Date();
    if (filter === 'CANCELLED') return x.status === 'CANCELLED';
    return true;
  });

  async function handleCancel(apt: CustomerAppointment) {
    if (!confirm(`Are you sure you want to cancel your booking (${apt.bookingReference}) for ${apt.service.name}?`)) {
      return;
    }
    setActionMsg('');
    setError('');
    try {
      await api.customerCancelAppointment(apt.id);
      setActionMsg(`Appointment ${apt.bookingReference} cancelled successfully.`);
      load();
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <Page title="My Appointments">
      {error && <p className="alert">{error}</p>}
      {actionMsg && <p className="oktext">{actionMsg}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['ALL', 'UPCOMING', 'PAST', 'CANCELLED'].map((f) => (
          <button
            key={f}
            className={filter === f ? '' : 'secondary'}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="rows">
        {filtered.length === 0 ? (
          <p>No appointments found.</p>
        ) : (
          filtered.map((x) => {
            const canCancel = x.status === 'CONFIRMED' && (new Date(x.startAt).getTime() - Date.now()) > 3600000;
            return (
              <article className="row" key={x.id}>
                <div>
                  <strong>{x.service.name}</strong> · {x.business.name}
                  <br />
                  <small>
                    Date & Time: {new Date(x.startAt).toLocaleString()} ({x.business.timezone})
                    <br />
                    Ref: <strong>{x.bookingReference}</strong>
                    {x.staff ? ` · Staff: ${x.staff.name}` : ''}
                  </small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge x={x.status} />
                  <Link to={`/customer/appointments/${x.id}`}>
                    <button className="secondary">Details</button>
                  </Link>
                  {canCancel && (
                    <button className="danger" onClick={() => handleCancel(x)}>
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </Page>
  );
}

function CustomerAppointmentDetail() {
  const { id = '' } = useParams();
  const n = useNavigate();
  const [apt, setApt] = useState<CustomerAppointment | null>(null);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const load = () => {
    api
      .customerAppointmentDetail(id)
      .then((x) => setApt(x.appointment))
      .catch((e) => setError(message(e)));
  };

  useEffect(() => {
    load();
  }, [id]);

  if (error && !apt) {
    return (
      <Page title="Appointment Details">
        <p className="alert">{error}</p>
        <button onClick={() => n('/customer/appointments')}>Back to Appointments</button>
      </Page>
    );
  }

  if (!apt) return <p>Loading appointment details…</p>;

  const canCancel = apt.status === 'CONFIRMED' && (new Date(apt.startAt).getTime() - Date.now()) > 3600000;

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    setError('');
    setActionMsg('');
    try {
      await api.customerCancelAppointment(id);
      setActionMsg('Appointment cancelled successfully.');
      load();
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <Page
      title={`Booking Details: ${apt.bookingReference}`}
      action={
        <button className="secondary" onClick={() => n('/customer/appointments')}>
          Back to List
        </button>
      }
    >
      {error && <p className="alert">{error}</p>}
      {actionMsg && <p className="oktext">{actionMsg}</p>}

      <div className="card grid">
        <div>
          <h3>Business</h3>
          <p>{apt.business.name}</p>
        </div>
        <div>
          <h3>Status</h3>
          <p><Badge x={apt.status} /></p>
        </div>
        <div>
          <h3>Service</h3>
          <p>
            {apt.service.name} ({apt.service.durationMinutes} mins)
            <br />
            <small>{apt.service.description || 'No description'}</small>
          </p>
        </div>
        <div>
          <h3>Staff Member</h3>
          <p>{apt.staff ? apt.staff.name : 'Business-wide / Any available'}</p>
        </div>
        <div>
          <h3>Date & Time</h3>
          <p>
            Start: {new Date(apt.startAt).toLocaleString()}
            <br />
            End: {new Date(apt.endAt).toLocaleString()}
            <br />
            Timezone: {apt.business.timezone}
          </p>
        </div>
        <div>
          <h3>Customer Info</h3>
          <p>
            {apt.customerName}
            <br />
            {apt.customerEmail}
            <br />
            {apt.customerPhone}
          </p>
        </div>

        <div style={{ gridColumn: 'span 2', marginTop: '1rem', display: 'flex', gap: '1rem' }}>
          {canCancel && (
            <button className="danger" onClick={handleCancel}>
              Cancel Appointment
            </button>
          )}
        </div>
      </div>
    </Page>
  );
}

function Businesses() {
  const [items, setItems] = useState<Business[] | null>(null),
    [show, setShow] = useState(false),
    [error, setError] = useState('');
  const load = () =>
    api
      .businesses()
      .then((x) => setItems(x.businesses))
      .catch((e) => setError(message(e)));
  useEffect(() => {
    void load();
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await api.createBusiness(Object.fromEntries(new FormData(e.currentTarget)));
      setShow(false);
      void load();
    } catch (e) {
      setError(message(e));
    }
  }
  if (!items) return <p>Loading businesses…</p>;
  return (
    <Page title="Businesses" action={<button onClick={() => setShow(true)}>New business</button>}>
      {error && <p className="alert">{error}</p>}
      {show && (
        <div className="card">
          <form onSubmit={save} className="grid">
            <label>
              Business Name
              <input name="name" required />
            </label>
            <label>
              Business Email
              <input name="contactEmail" type="email" required />
            </label>
            <label>
              Business Phone
              <input name="contactPhone" required />
            </label>
            <label>
              Timezone
              <input name="timezone" defaultValue="Asia/Kolkata" required />
            </label>
            <label>
              Status
              <select name="status">
                <option>ACTIVE</option>
                <option>DISABLED</option>
              </select>
            </label>
            
            <hr style={{ gridColumn: '1 / -1', margin: '1rem 0' }} />
            <h3 style={{ gridColumn: '1 / -1', marginTop: 0 }}>Business Admin Details</h3>

            <label>
              Admin Name
              <input name="adminName" required />
            </label>
            <label>
              Admin Email
              <input name="adminEmail" type="email" required />
            </label>
            <label>
              Admin Password
              <input name="adminPassword" type="password" minLength={8} required />
            </label>

            <button style={{ gridColumn: '1 / -1' }}>Create Business & Admin</button>
          </form>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Timezone</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((x) => (
            <tr key={x.id}>
              <td>{x.name}</td>
              <td>
                {x.contactEmail}
                <br />
                {x.contactPhone}
              </td>
              <td>{x.timezone}</td>
              <td>
                <Badge x={x.status} />
              </td>
              <td>
                <button
                  className="secondary"
                  onClick={() =>
                    api.businessStatus(x.id, x.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE').then(() => load())
                  }
                >
                  {x.status === 'ACTIVE' ? 'Disable' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}

function Profile() {
  const [b, setB] = useState<Business | null>(null),
    [note, setNote] = useState('');
  useEffect(() => {
    api
      .profile()
      .then((x) => setB(x.business))
      .catch((e) => setNote(message(e)));
  }, []);
  if (!b) return <p>Loading profile…</p>;
  return (
    <Page title="Business profile">
      <p className="oktext">{note}</p>
      <form
        className="card grid"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await api.updateProfile(Object.fromEntries(new FormData(e.currentTarget)));
            setB(r.business);
            setNote('Profile saved.');
          } catch (e) {
            setNote(message(e));
          }
        }}
      >
        <label>
          Name
          <input name="name" defaultValue={b.name} required />
        </label>
        <label>
          Email
          <input name="contactEmail" type="email" defaultValue={b.contactEmail} required />
        </label>
        <label>
          Phone
          <input name="contactPhone" defaultValue={b.contactPhone} required />
        </label>
        <label>
          Timezone
          <input name="timezone" defaultValue={b.timezone} required />
        </label>
        <button>Save changes</button>
      </form>
    </Page>
  );
}

function Crud({ kind }: { kind: 'services' | 'staff' }) {
  const isService = kind === 'services';
  const [items, setItems] = useState<(Service | Staff)[] | null>(null),
    [show, setShow] = useState(false),
    [note, setNote] = useState('');
  const load = () =>
    (isService ? api.services() : api.staff())
      .then((x) => setItems(isService ? (x as { services: Service[] }).services : (x as { staff: Staff[] }).staff))
      .catch((e) => setNote(message(e)));
  useEffect(() => {
    void load();
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    if (isService && Number(d.durationMinutes) <= 0) {
      setNote('Duration must be a positive number.');
      return;
    }
    try {
      isService
        ? await api.createService({ ...d, durationMinutes: Number(d.durationMinutes) })
        : await api.createStaff(d);
      setShow(false);
      void load();
    } catch (e) {
      setNote(message(e));
    }
  }
  if (!items) return <p>Loading {kind}…</p>;
  return (
    <Page
      title={isService ? 'Services' : 'Staff'}
      action={<button onClick={() => setShow(true)}>Add {isService ? 'service' : 'staff'}</button>}
    >
      <p className="alert">{note}</p>
      {show && (
        <form className="card grid" onSubmit={save}>
          <label>
            Name
            <input name="name" required />
          </label>
          {isService ? (
            <>
              <label>
                Description
                <input name="description" />
              </label>
              <label>
                Duration
                <input name="durationMinutes" type="number" min="1" required />
              </label>
              <label>
                Status
                <select name="status">
                  <option>ACTIVE</option>
                  <option>INACTIVE</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                Email
                <input name="email" type="email" required />
              </label>
              <label>
                Status
                <select name="status">
                  <option>ACTIVE</option>
                  <option>DISABLED</option>
                </select>
              </label>
            </>
          )}
          <button>Create</button>
        </form>
      )}
      <div className="rows">
        {items.length === 0 ? (
          <p>No {kind} have been configured yet.</p>
        ) : (
          items.map((x) => (
            <article className="row" key={x.id}>
              <div>
                <strong>{x.name}</strong>
                <br />
                <small>
                  {isService
                    ? `${(x as Service).description || 'No description'} · ${(x as Service).durationMinutes} minutes`
                    : (x as Staff).email}
                </small>
              </div>
              <Badge x={x.status} />
              <button
                className="text"
                onClick={() => {
                  if (confirm('Delete this item?')) api.delete(`/api/${kind}/${x.id}`).then(() => load());
                }}
              >
                Delete
              </button>
            </article>
          ))
        )}
      </div>
    </Page>
  );
}

function AvailabilityPage() {
  const [items, setItems] = useState<Availability[] | null>(null),
    [staff, setStaff] = useState<Staff[]>([]),
    [note, setNote] = useState('');
  const load = () =>
    Promise.all([api.availability(), api.staff()])
      .then(([a, s]) => {
        setItems(a.availability);
        setStaff(s.staff);
      })
      .catch((e) => setNote(message(e)));
  useEffect(load, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (d.startTime >= d.endTime) {
      setNote('Start time must be before end time.');
      return;
    }
    try {
      await api.createAvailability({
        dayOfWeek: Number(d.dayOfWeek),
        startTime: d.startTime,
        endTime: d.endTime,
        staffId: d.staffId || null,
        status: d.status,
      });
      load();
      e.currentTarget.reset();
    } catch (e) {
      setNote(message(e));
    }
  }
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (!items) return <p>Loading availability…</p>;
  return (
    <Page title="Availability">
      <p className="alert">{note}</p>
      <form className="card grid" onSubmit={save}>
        <label>
          Day
          <select name="dayOfWeek">
            {days.map((x, i) => (
              <option value={i} key={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start
          <input name="startTime" type="time" required />
        </label>
        <label>
          End
          <input name="endTime" type="time" required />
        </label>
        <label>
          Staff
          <select name="staffId">
            <option value="">Business-wide</option>
            {staff.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status">
            <option>ACTIVE</option>
            <option>DISABLED</option>
          </select>
        </label>
        <button>Add availability</button>
      </form>
      <div className="rows">
        {items.length === 0 ? (
          <p>No availability has been configured yet.</p>
        ) : (
          items.map((x) => (
            <article className="row" key={x.id}>
              <div>
                <strong>
                  {days[x.dayOfWeek]} {x.startTime}–{x.endTime}
                </strong>
                <br />
                <small>{staff.find((s) => s.id === x.staffId)?.name || 'Business-wide'}</small>
              </div>
              <Badge x={x.status} />
              <button className="text" onClick={() => api.delete(`/api/availability/${x.id}`).then(load)}>
                Remove
              </button>
            </article>
          ))
        )}
      </div>
    </Page>
  );
}

function Appointments() {
  const [all, setAll] = useState<Appointment[] | null>(null),
    [status, setStatus] = useState('');
  useEffect(() => {
    api.appointments().then((x) => setAll(x.appointments));
  }, []);
  if (!all) return <p>Loading appointments…</p>;
  const items = all.filter((x) => !status || x.status === status);
  return (
    <Page title="Appointments">
      <label>
        Filter by status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <div className="rows">
        {items.length === 0 ? (
          <p>No appointments found.</p>
        ) : (
          items.map((x) => (
            <article className="row" key={x.id}>
              <div>
                <strong>
                  {x.customerName} · {x.bookingReference}
                </strong>
                <br />
                <small>
                  {x.service.name} · {new Date(x.startAt).toLocaleString()} · {x.customerEmail}
                </small>
              </div>
              <Badge x={x.status} />
              <select
                value={x.status}
                onChange={(e) => {
                  if (e.target.value === 'CANCELLED' && !confirm('Cancel this appointment?')) return;
                  patch(`/api/appointments/${x.id}/status`, { status: e.target.value })
                    .then(() => api.appointments())
                    .then((r) => setAll(r.appointments));
                }}
              >
                {['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </article>
          ))
        )}
      </div>
    </Page>
  );
}

function BrowseBusinesses() {
  const auth = useAuth();
  const [items, setItems] = useState<Business[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .bookingBusinesses()
      .then((x) => setItems(x.businesses))
      .catch((e) => setError(message(e)));
  }, []);

  return (
    <main className="booking">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <Link to="/booking">Look up an existing booking</Link>
        {auth.customer ? (
          <small className="oktext">
            Logged in as {auth.customer.name} · <Link to="/customer/dashboard">Dashboard</Link>
          </small>
        ) : (
          <small>
            <Link to="/customer/login">Customer Sign in</Link> · <Link to="/customer/signup">Customer Signup</Link>
          </small>
        )}
      </div>
      <h1>Browse businesses</h1>
      <p>Select a business to book a service.</p>
      {error && <p className="alert">{error}</p>}
      {!items ? (
        <p>Loading businesses…</p>
      ) : items.length === 0 ? (
        <p>No businesses are currently accepting bookings.</p>
      ) : (
        <div className="choices">
          {items.map((b) => (
            <Link key={b.id} to={`/book/${b.id}`}>
              <button>
                <strong>{b.name}</strong>
                <br />
                <small>
                  {b.timezone}
                  {b.contactPhone ? ` · ${b.contactPhone}` : ''}
                </small>
              </button>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function Booking() {
  const { businessId = '' } = useParams(),
    nav = useNavigate();
  const auth = useAuth();
  const [b, setB] = useState<Business | null>(null),
    [services, setServices] = useState<Service[]>([]),
    [staff, setStaff] = useState<Staff[]>([]),
    [service, setService] = useState<Service | null>(null),
    [staffId, setStaffId] = useState(''),
    [date, setDate] = useState(''),
    [slots, setSlots] = useState<string[]>([]),
    [slot, setSlot] = useState(''),
    [details, setDetails] = useState({
      customerName: auth.customer?.name || '',
      customerEmail: auth.customer?.email || '',
      customerPhone: auth.customer?.phone || '',
    }),
    [step, setStep] = useState(1),
    [note, setNote] = useState('');

  useEffect(() => {
    if (auth.customer) {
      setDetails((prev) => ({
        customerName: prev.customerName || auth.customer?.name || '',
        customerEmail: prev.customerEmail || auth.customer?.email || '',
        customerPhone: prev.customerPhone || auth.customer?.phone || '',
      }));
    }
  }, [auth.customer]);

  useEffect(() => {
    Promise.all([api.bookingBusiness(businessId), api.bookingServices(businessId), api.bookingStaff(businessId)])
      .then(([x, y, z]) => {
        setB(x.business);
        setServices(y.services);
        setStaff(z.staff);
      })
      .catch((e) => setNote(message(e)));
  }, [businessId]);

  useEffect(() => {
    if (service && date)
      api
        .slots(businessId, service.id, date, staffId || undefined)
        .then((x) => setSlots(x.slots))
        .catch((e) => setNote(message(e)));
  }, [service, date, staffId, businessId]);

  if (note && !b)
    return (
      <main className="booking">
        <h1>Booking unavailable</h1>
        <p>{note}</p>
      </main>
    );
  if (!b) return <main className="booking">Loading booking experience…</main>;

  const validDetails = z
    .object({
      customerName: z.string().min(1, 'Name is required.'),
      customerEmail: z.string().email('Valid email required.'),
      customerPhone: z.string().min(7, 'Valid phone required.'),
    })
    .safeParse(details);

  async function confirm() {
    if (!service || !slot) return;
    try {
      const r = await api.book({
        businessId,
        serviceId: service.id,
        staffId: staffId || null,
        startAt: slot,
        ...details,
        timezone: b.timezone,
      });
      nav(`/booking/confirmation/${r.appointment.bookingReference}`, {
        state: { appointment: r.appointment, business: b },
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setNote('This time slot is no longer available. Please select another time.');
        setStep(3);
        api
          .slots(businessId, service.id, date, staffId || undefined)
          .then((x) => setSlots(x.slots));
      } else setNote(message(e));
    }
  }

  return (
    <main className="booking">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          <Link to="/book">Browse businesses</Link>
          {' · '}
          <Link to="/booking">Look up an existing booking</Link>
        </span>
        {auth.customer ? (
          <small className="oktext">Logged in as {auth.customer.name}</small>
        ) : (
          <small>
            <Link to="/customer/login">Sign in for faster booking</Link>
          </small>
        )}
      </div>
      <small>{b.timezone}</small>
      <h1>Book with {b.name}</h1>
      {note && <p className="alert">{note}</p>}
      <div className="steps">Step {step} of 5</div>
      {step === 1 && (
        <section>
          <h2>Select a service</h2>
          <div className="choices">
            {services.map((x) => (
              <button
                className={service?.id === x.id ? 'chosen' : ''}
                key={x.id}
                onClick={() => {
                  setService(x);
                  setStep(2);
                }}
              >
                <strong>{x.name}</strong>
                <br />
                <small>
                  {x.description} · {x.durationMinutes} min
                </small>
              </button>
            ))}
          </div>
        </section>
      )}
      {step === 2 && (
        <section>
          <h2>Select date and staff</h2>
          <label>
            Date
            <input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Staff
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Business-wide availability</option>
              {staff.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!date} onClick={() => setStep(3)}>
            View available times
          </button>
        </section>
      )}
      {step === 3 && (
        <section>
          <h2>Available times</h2>
          {slots.length === 0 ? (
            <p>No available slots for this date.</p>
          ) : (
            <div className="slots">
              {slots.map((x) => (
                <button
                  key={x}
                  className={slot === x ? 'chosen' : ''}
                  onClick={() => {
                    setSlot(x);
                    setStep(4);
                  }}
                >
                  {new Intl.DateTimeFormat(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: b.timezone,
                  }).format(new Date(x))}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {step === 4 && (
        <section>
          <h2>Your details</h2>
          <form
            className="grid"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validDetails.success) {
                setNote(validDetails.error.issues[0].message);
                return;
              }
              setNote('');
              setStep(5);
            }}
          >
            <label>
              Name
              <input
                value={details.customerName}
                onChange={(e) => setDetails({ ...details, customerName: e.target.value })}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={details.customerEmail}
                onChange={(e) => setDetails({ ...details, customerEmail: e.target.value })}
              />
            </label>
            <label>
              Phone
              <input
                value={details.customerPhone}
                onChange={(e) => setDetails({ ...details, customerPhone: e.target.value })}
              />
            </label>
            <button>Review booking</button>
          </form>
        </section>
      )}
      {step === 5 && (
        <section className="card">
          <h2>Review booking</h2>
          <p>
            {b.name} · {service?.name} · {service?.durationMinutes} minutes
          </p>
          <p>
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: 'full',
              timeStyle: 'short',
              timeZone: b.timezone,
            }).format(new Date(slot))}{' '}
            ({b.timezone})
          </p>
          <p>
            {details.customerName}
            <br />
            {details.customerEmail}
            <br />
            {details.customerPhone}
          </p>
          <button onClick={confirm}>Confirm booking</button>
          <button className="text" onClick={() => setStep(4)}>
            Back
          </button>
        </section>
      )}
    </main>
  );
}

function Confirmation() {
  const { bookingReference = '' } = useParams(),
    loc = history.state?.usr as { appointment?: Appointment; business?: Business } | undefined;
  const a = loc?.appointment;
  const auth = useAuth();

  return (
    <main className="booking">
      <h1>Booking confirmed</h1>
      <p>
        Keep this reference: <strong>{bookingReference}</strong>
      </p>
      {a && (
        <>
          <p>
            {a.service.name} · {new Date(a.startAt).toLocaleString()}
          </p>
          <p>
            Status: <Badge x={a.status} />
          </p>
        </>
      )}
      {auth.customer ? (
        <Link to="/customer/appointments">
          <button>View My Appointments</button>
        </Link>
      ) : (
        <Link to="/booking">Done</Link>
      )}
    </main>
  );
}

function Lookup() {
  const [a, setA] = useState<(Appointment & { business: Business }) | null>(null),
    [note, setNote] = useState(''),
    [values, setValues] = useState({ reference: '', email: '' });

  async function find(e: FormEvent) {
    e.preventDefault();
    try {
      setA((await api.lookup(values.reference, values.email)).appointment);
      setNote('');
    } catch (e) {
      setA(null);
      setNote(message(e));
    }
  }

  return (
    <main className="booking">
      <h1>Find your booking</h1>
      <p>{note}</p>
      <form className="grid" onSubmit={find}>
        <label>
          Booking reference
          <input
            value={values.reference}
            onChange={(e) => setValues({ ...values, reference: e.target.value })}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
            required
          />
        </label>
        <button>Find booking</button>
      </form>
      {a && (
        <article className="card">
          <h2>{a.business.name}</h2>
          <p>
            {a.service.name} · {new Date(a.startAt).toLocaleString()}
            <br />
            Reference: {a.bookingReference}
            <br />
            <Badge x={a.status} />
          </p>
          {a.status !== 'CANCELLED' && (
            <button
              className="danger"
              onClick={() => {
                if (confirm('Cancel this booking?'))
                  api
                    .cancel(a.bookingReference, values.email)
                    .then(() => {
                      setA({ ...a, status: 'CANCELLED' });
                      setNote('Booking cancelled.');
                    })
                    .catch((e) => setNote(message(e)));
              }}
            >
              Cancel booking
            </button>
          )}
        </article>
      )}
    </main>
  );
}

function App() {
  return (
    <Provider>
      <Routes>
        {/* Customer Auth & App Routes */}
        <Route path="/customer/login" element={<CustomerLogin />} />
        <Route path="/customer/signup" element={<CustomerSignup />} />
        <Route
          path="/customer/dashboard"
          element={
            <CustomerGuard>
              <CustomerShell>
                <CustomerDashboard />
              </CustomerShell>
            </CustomerGuard>
          }
        />
        <Route
          path="/customer/profile"
          element={
            <CustomerGuard>
              <CustomerShell>
                <CustomerProfilePage />
              </CustomerShell>
            </CustomerGuard>
          }
        />
        <Route
          path="/customer/appointments"
          element={
            <CustomerGuard>
              <CustomerShell>
                <CustomerAppointmentsPage />
              </CustomerShell>
            </CustomerGuard>
          }
        />
        <Route
          path="/customer/appointments/:id"
          element={
            <CustomerGuard>
              <CustomerShell>
                <CustomerAppointmentDetail />
              </CustomerShell>
            </CustomerGuard>
          }
        />

        {/* System & Admin Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/book" element={<BrowseBusinesses />} />
        <Route path="/book/:businessId" element={<Booking />} />
        <Route path="/booking" element={<Lookup />} />
        <Route path="/booking/confirmation/:bookingReference" element={<Confirmation />} />
        <Route
          path="/dashboard"
          element={
            <Guard>
              <Shell>
                <Dashboard />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/admin"
          element={
            <Guard role="SYSTEM_OWNER">
              <Shell>
                <Businesses />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/business"
          element={
            <Guard role="BUSINESS_ADMIN">
              <Shell>
                <Profile />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/services"
          element={
            <Guard role="BUSINESS_ADMIN">
              <Shell>
                <Crud kind="services" />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/staff"
          element={
            <Guard role="BUSINESS_ADMIN">
              <Shell>
                <Crud kind="staff" />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/availability"
          element={
            <Guard role="BUSINESS_ADMIN">
              <Shell>
                <AvailabilityPage />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/appointments"
          element={
            <Guard role="BUSINESS_ADMIN">
              <Shell>
                <Appointments />
              </Shell>
            </Guard>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
