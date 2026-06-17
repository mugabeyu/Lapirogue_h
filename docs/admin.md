# La Pirogue Hotel — Admin Management System Documentation

## Architecture Overview

```
Layer          | Tech
-------------- | -----
Frontend       | Next.js 16 App Router, React 18, TypeScript, Tailwind CSS
Data Fetching  | SWR (client), server-side Supabase queries (server)
Auth           | Supabase Auth + JWT (jose) + cookies (supabase/ssr)
Backend        | Next.js API Routes (REST), Supabase Admin (service role)
Email          | Resend API (guest portal invites, invoices, password resets)
PDF            | jsPDF (invoices)
Validation     | Zod
Animations     | Framer Motion
UI Icons       | Lucide React
Charts         | Recharts
```

The admin system uses **Server Components** for layout/auth, **Client Components** for interactive pages, and **API Routes** for all CRUD operations. Supabase is accessed via the **service role key** (admin bypasses RLS) for all internal operations.

---

## Project Structure

```
Hotel/
├── middleware.ts                        # Auth gate (Supabase SSR cookies)
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (Inter font, Toaster)
│   │   ├── page.tsx                    # Landing page (redirects to /dashboard)
│   │   ├── globals.css                 # Tailwind + CSS variables
│   │   ├── (auth)/                     # Auth route group
│   │   │   ├── login/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (dashboard)/               # Dashboard route group (protected)
│   │   │   ├── layout.tsx              # Server-side auth check + Layout shell
│   │   │   ├── page.tsx                # Dashboard overview
│   │   │   ├── guests/page.tsx
│   │   │   ├── guests/[id]/page.tsx
│   │   │   ├── rooms/page.tsx
│   │   │   ├── rooms/assign/page.tsx
│   │   │   ├── reservations/page.tsx
│   │   │   ├── reservations/new/page.tsx
│   │   │   ├── reservations/calendar/page.tsx
│   │   │   ├── activities/page.tsx
│   │   │   ├── activities/new/page.tsx
│   │   │   ├── activities/calendar/page.tsx
│   │   │   ├── food-beverage/page.tsx
│   │   │   ├── food-beverage/orders/page.tsx
│   │   │   ├── food-beverage/orders/new/page.tsx
│   │   │   ├── payments/page.tsx
│   │   │   ├── payments/[id]/page.tsx
│   │   │   ├── messages/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── schedule/page.tsx
│   │   │   ├── feedback/page.tsx
│   │   │   ├── sustainability/page.tsx
│   │   │   ├── staff/page.tsx
│   │   │   ├── staff/roles/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   └── invoice/page.tsx
│   │   ├── dashboard/page.tsx          # Legacy dashboard route
│   │   ├── emergency-contacts/page.tsx
│   │   └── api/                        # 40+ API route files
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   ├── me/route.ts
│   │       │   ├── forgot-password/route.ts
│   │       │   ├── verify/route.ts
│   │       │   └── password-sync/route.ts
│   │       ├── dashboard/route.ts
│   │       ├── guests/route.ts
│   │       ├── guests/[id]/route.ts
│   │       ├── guests/[id]/profile/route.ts
│   │       ├── guests/[id]/resend-portal/route.ts
│   │       ├── guests/register-account/route.ts
│   │       ├── rooms/route.ts
│   │       ├── reservations/route.ts
│   │       ├── reservations/calendar/route.ts
│   │       ├── activities/route.ts
│   │       ├── activities/book/route.ts
│   │       ├── activities/calendar/route.ts
│   │       ├── menu-items/route.ts
│   │       ├── food-orders/route.ts
│   │       ├── payments/route.ts
│   │       ├── payments/[id]/route.ts
│   │       ├── payments/[id]/send-invoice/route.ts
│   │       ├── messages/route.ts
│   │       ├── notifications/route.ts
│   │       ├── schedule/route.ts
│   │       ├── schedule/options/route.ts
│   │       ├── staff/route.ts
│   │       ├── staff/onboarding/route.ts
│   │       ├── staff/reinvite/route.ts
│   │       ├── roles/route.ts
│   │       ├── feedback/route.ts
│   │       ├── sustainability/route.ts
│   │       ├── sustainability/award/route.ts
│   │       ├── hotel-services/route.ts
│   │       ├── hotel-service-categories/route.ts
│   │       ├── emergency-contacts/route.ts
│   │       ├── content/about/route.ts
│   │       ├── reports/route.ts
│   │       ├── settings/profile/route.ts
│   │       └── settings/password/route.ts
│   ├── components/
│   │   ├── Layout.tsx                  # Client shell (Sidebar + Topbar)
│   │   ├── Sidebar.tsx                 # Navigation sidebar
│   │   ├── Topbar.tsx                  # Top bar (sidebar toggle, user menu)
│   │   ├── ProtectedPage.tsx           # Client-side auth guard
│   │   ├── DashboardDataPage.tsx       # Dashboard overview widget
│   │   ├── GuestsPage.tsx              # Guest list page
│   │   ├── GuestDetailsPage.tsx        # Guest profile (5 tabs)
│   │   ├── RoomsPage.tsx               # Room management
│   │   ├── PageHeader.tsx              # Reusable page header
│   │   ├── StatCard.tsx                # Stats display card
│   │   ├── StatusBadge.tsx             # Status badges (colored)
│   │   ├── DataTablePage.tsx           # Generic data table
│   │   ├── CrudDataTablePage.tsx       # CRUD data table helper
│   │   ├── DashboardDataPage.tsx       # Dashboard stats + lists
│   │   ├── ConfirmDialog.tsx           # Reusable confirm modal
│   │   ├── Modal.tsx                   # Reusable modal
│   │   ├── food-beverage/              # Menu + order components
│   │   ├── activities/                 # Activity components
│   │   ├── payments/                   # Payment components
│   │   ├── feedback/                   # Feedback components
│   │   ├── sustainability/             # Sustainability components
│   │   ├── settings/                   # Settings components
│   │   ├── forms/                      # Form components
│   │   ├── modals/
│   │   │   ├── AddGuestModal.tsx
│   │   │   ├── EditGuestModal.tsx
│   │   │   ├── RoomModal.tsx
│   │   │   ├── StaffModal.tsx
│   │   │   ├── PaymentModal.tsx
│   │   │   ├── MenuItemModal.tsx
│   │   │   ├── AddActivityModal.tsx
│   │   │   ├── AddReservationModal.tsx
│   │   │   ├── BookActivityModal.tsx
│   │   │   ├── AddFoodOrderModal.tsx
│   │   │   └── CreateScheduleItemModal.tsx
│   │   ├── pickers/
│   │   │   ├── GuestSearchPicker.tsx
│   │   │   ├── RoomSearchPicker.tsx
│   │   │   └── GuestRoomSearchField.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── FormSection.tsx
│   │       ├── LabeledTable.tsx
│   │       ├── PhoneField.tsx
│   │       ├── CountryComboboxField.tsx
│   │       └── ImageUploadField.tsx
│   ├── contexts/
│   │   └── SidebarContext.tsx          # Sidebar collapsed state
│   ├── hooks/
│   │   └── useApi.ts                   # SWR-based data fetching
│   ├── lib/
│   │   ├── supabase.ts                 # Admin Supabase client
│   │   ├── supabase-server.ts          # Route handler Supabase client (SSR cookies)
│   │   ├── supabase-config.ts          # URL/key config reader
│   │   ├── auth-server.ts              # Server session lookup
│   │   ├── billing.ts                  # Billing summary builder
│   │   ├── invoice-pdf.ts              # jsPDF invoice generator
│   │   ├── mailer.ts                   # Email templates (Resend)
│   │   ├── resend.ts                   # Resend client init
│   │   ├── guests.ts                   # Guest query helpers
│   │   ├── guest-profile.ts            # Profile data aggregator
│   │   ├── menu.ts                     # Menu query helpers
│   │   ├── activities.ts               # Activity query helpers
│   │   ├── date-utils.ts               # Date formatting helpers
│   │   ├── countries.ts                # Country list
│   │   ├── phone.ts                    # Phone formatting
│   │   ├── audit.ts                    # Audit logging
│   │   ├── router.ts                   # Router helpers
│   │   └── table-helpers.ts            # Table utility helpers
│   └── types/
│       └── index.ts                    # All TypeScript interfaces
```

---

## 1. Middleware — Auth Gate (`middleware.ts`)

The middleware runs on every request (except static files). It creates a Supabase SSR client from cookies, checks the user session, and redirects accordingly.

```ts
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // API protection
  if (pathname.startsWith('/api/')) {
    if (isPublicApi(pathname)) return response;
    if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    return response;
  }

  // Page protection
  if (user && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (!user && !isAuthRoute(pathname)) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

---

## 2. Auth Flow

### Login (`src/app/api/auth/login/route.ts`)

Uses Supabase Auth with SSR cookies. Validates credentials via Zod, checks if the staff profile is active, upserts profile data, and attaches Supabase auth cookies to the response.

```ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validatedData = loginSchema.parse(body);

  const { supabase, response } = createRouteHandlerSupabaseContext(request);
  const signInResult = await supabase.auth.signInWithPassword({
    email: validatedData.email, password: validatedData.password,
  });

  // Check if staff account is active
  const { data: profileRow } = await supabase
    .from('profiles').select('auth_id, is_active')
    .eq('auth_id', signInData.user.id).maybeSingle();

  if (profileRow?.is_active === false) {
    return NextResponse.json({ success: false, error: 'Account is blocked' }, { status: 403 });
  }

  // Attach Supabase cookies to response
  const result = attachSupabaseCookies(
    NextResponse.json({ success: true, data: { user: signInData.user } }),
    response,
  );
  return result;
}
```

### Server Session Lookup (`src/lib/auth-server.ts`)

Used by the dashboard layout to read the session server-side.

```ts
export async function getServerSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileRow } = await supabase
    .from('profiles').select('email, full_name, role, is_main, is_active')
    .eq('auth_id', user.id).maybeSingle();

  return {
    id: user.id, email: profileRow?.email ?? '',
    name: profileRow?.full_name ?? '',
    role: profileRow?.is_main ? 'MAIN_RECEPTIONIST' : normalizeRole(profileRow?.role),
    isActive: profileRow?.is_active !== false,
  };
}
```

### Login Page (`src/app/(auth)/login/page.tsx`)

Client component that calls `/api/auth/login` POST, then redirects. Also checks `/api/auth/me` on mount to redirect if already authenticated.

```tsx
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json();
  if (!result?.success) { setErrorMessage(result?.error || 'Login failed'); return; }
  router.push(getRedirectPath());
  router.refresh();
};
```

---

## 3. Dashboard Layout (`src/app/(dashboard)/layout.tsx`)

Server component that checks the session and wraps children in the `Layout` shell (Sidebar + Topbar).

```tsx
export default async function DashboardLayout({ children }) {
  const session = await getServerSession();
  if (!session) redirect('/login');
  return <Layout>{children}</Layout>;
}
```

---

## 4. Dashboard API — Parallel Supabase Queries (`src/app/api/dashboard/route.ts`)

Executes **15 parallel Supabase queries** using `Promise.all` to gather all dashboard stats: room counts by status, guest count, reservation counts, check-ins/outs today, revenue, pending payments, today's arrivals, and departures.

```ts
const [
  totalRoomsResult, occupiedRoomsResult, availableRoomsResult,
  cleaningRoomsResult, maintenanceRoomsResult, totalGuestsResult,
  activeReservationsResult, checkinsTodayResult, checkoutsTodayResult,
  paymentsResult, reservationsResult, activityBookingsResult,
  foodOrdersResult, checkinsListResult, checkoutsListResult,
] = await Promise.all([
  supabase.from('rooms').select('id', { count: 'exact', head: true }),
  supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('status', 'OCCUPIED'),
  // ... 13 more queries
]);
```

Then computes derived metrics: occupancy rate, total revenue from completed payments, per-guest balance (charges minus payments), and pending payments sum.

---

## 5. Supabase Admin Client (`src/lib/supabase.ts`)

Uses the service role key to bypass RLS. Created with `server-only` import to prevent client usage. Includes a 60-second fetch timeout.

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

function createFetchWithTimeout(timeoutMs: number) {
  return async (input, init?) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(input, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timeoutId); }
  };
}

export function getSupabaseAdmin() {
  return createClient(resolvedSupabaseUrl, resolvedSupabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createFetchWithTimeout(60000) },
  });
}
```

---

## 6. Client Data Fetching — SWR Hook (`src/hooks/useApi.ts`)

Wraps SWR with a generic `ApiResponse<T>` type, handling the `{ success, data, error }` envelope returned by all API routes.

```ts
const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'include' });
  return response.json();
};

export function useApi<T>(url: string | null) {
  const { data, error, mutate } = useSWR<ApiResponse<T>>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  return {
    data: data?.success !== false ? data?.data : undefined,
    error: apiError ?? (error instanceof Error ? error.message : null),
    mutate,
  };
}
```

---

## 7. TypeScript Types (`src/types/index.ts`)

All data models are defined as TypeScript interfaces, matching the Supabase PostgreSQL schema exactly.

```ts
export interface Guest {
  id: string; guestId: string; firstName: string; lastName: string;
  email?: string; phone?: string; nationality?: string; passport?: string;
  dateOfBirth?: string; vip: boolean; status: GuestStatus;
  notes?: string; imagePath?: string;
}

export interface GuestProfileData {
  guest: Guest;
  currentStay: GuestStay | null;
  reservations: GuestStay[];
  activityBookings: Array<{ id: string; activity: string | null; ... }>;
  foodOrders: Array<{ id: string; orderId: string; total: number; ... }>;
  payments: Array<{ id: string; paymentId: string; amount: number; ... }>;
  stats: { totalStays: number; activities: number; foodOrders: number; totalSpent: number; balanceDue: number; };
  billingSummary?: BillingSummary;
}

export type Role = 'MAIN_RECEPTIONIST' | 'RECEPTIONIST';
export type GuestStatus = 'RESERVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
export type RoomType = 'STANDARD' | 'DELUXE' | 'SUITE' | 'VILLA';
export type ReservationStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'ONLINE';
export type PaymentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
```

---

## 8. Navigation — Sidebar (`src/components/Sidebar.tsx`)

Defines all nav items and sub-items. Highlights the active section based on pathname. Supports collapse/expand via context.

```tsx
const navItems: NavItem[] = [
  { path: '/dashboard',    label: 'Dashboard',      icon: LayoutDashboardIcon },
  { path: '/guests',       label: 'Guests',          icon: UsersIcon },
  { path: '/rooms',        label: 'Rooms',           icon: BedDoubleIcon,
    children: [{ path: '/rooms/assign', label: 'Room Assignment' }] },
  { path: '/reservations', label: 'Reservations',    icon: CalendarCheckIcon,
    children: [{ path: '/reservations/calendar', label: 'Calendar View' },
               { path: '/reservations/new', label: 'New Reservation' }] },
  { path: '/activities',   label: 'Activities',      icon: PalmtreeIcon },
  { path: '/schedule',     label: 'Daily Schedules', icon: CalendarDaysIcon },
  { path: '/food-beverage',label: 'Food & Beverage', icon: UtensilsIcon },
  { path: '/payments',     label: 'Payments',        icon: CreditCardIcon },
  { path: '/messages',     label: 'Messages',        icon: MessageSquareIcon },
  { path: '/sustainability',label: 'Sustainability', icon: LeafIcon },
  { path: '/staff',        label: 'Staff Management',icon: UserCogIcon },
  { path: '/feedback',     label: 'Guest Feedback',  icon: StarIcon },
  { path: '/settings',     label: 'Settings',         icon: SettingsIcon },
];
```

---

## 9. Guests — List + Profile

### Guest List (`src/components/GuestsPage.tsx`)

Client component with search filtering, pagination (15 per page), and a "Register Guest" modal.

```tsx
export default function GuestsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (search.trim()) params.set('search', search.trim());
    return `/api/guests?${params.toString()}`;
  }, [search]);
  const { data, mutate } = useApi<Guest[]>(url);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.guestId, `${row.firstName} ${row.lastName}`, row.email, row.phone, row.roomNumber]
        .join(' ').toLowerCase().includes(query)
    );
  }, [rows, search]);
  // ... pagination logic
}
```

### Guest Profile (`src/components/GuestDetailsPage.tsx`)

Loads `GuestProfileData` from `/api/guests/[id]/profile` which aggregates data from 5 tables. Displays 5 tabs: Overview, Bookings, Activities, F&B Orders, Payments.

```tsx
export default function GuestDetailsPage() {
  const params = useParams<{ id: string }>();
  const { data: profile, mutate } = useApi<GuestProfileData>(`/api/guests/${params.id}/profile`);

  // Profile shows: name, email, phone, nationality, VIP badge, status
  // Tabs: Overview (current stay card + quick stats), Bookings, Activities, Food, Payments
  // Each tab renders a TabList with status badges
}
```

### Profile Data Aggregator (`src/lib/guest-profile.ts`)

Fetches from 4 tables in parallel and assembles the full profile + billing summary.

```ts
export async function loadGuestProfileData(guestId: string): Promise<GuestProfileData | null> {
  const [reservationsResult, activityBookingsResult, foodOrdersResult, paymentsResult] = await Promise.all([
    supabase.from('reservations').select('...').eq('guest_id', guestId),
    supabase.from('activity_bookings').select('..., activities(*)').eq('guest_id', guestId),
    supabase.from('food_orders').select('...').eq('guest_id', guestId),
    supabase.from('payments').select('...').eq('guest_id', guestId),
  ]);

  const billingSummary = buildBillingSummary({
    roomCharges, activityCharges, foodOrders, payments
  });

  return { guest, currentStay, reservations, activityBookings, foodOrders, payments, stats, billingSummary };
}
```

---

## 10. Reservations — CRUD with Conflict Detection (`src/app/api/reservations/route.ts`)

Full CRUD with Zod validation, date conflict detection, room availability check, and automatic guest portal invitation email on creation.

```ts
// POST - Create reservation with conflict detection
const { data: conflicting } = await supabase
  .from('reservations')
  .select('id')
  .eq('room_id', body.roomId)
  .or(`and(check_in.lte.${body.checkOut},check_out.gte.${body.checkIn})`)
  .neq('status', 'CANCELLED');

if (conflicting?.length > 0) {
  return createApiResponse(false, 'Room is not available for the selected dates', { status: 409 });
}

// Auto-send guest portal invitation
if (guestRow?.email && roomRow?.room_number) {
  await sendGuestPortalInvitationEmail({ to: guestRow.email, guestName, ... });
}

// PUT - Update with re-check availability, excluding self
  .neq('id', id); // exclude current reservation from conflict check

// DELETE - Blocked if payments reference this reservation
const { count: paymentCount } = await supabase
  .from('payments')
  .select('id', { count: 'exact', head: true })
  .eq('reservation_id', id);
if (paymentCount > 0) {
  return createApiResponse(false, 'Cannot delete: referenced by payments');
}
```

---

## 11. Payments — Immutable Once Finalized (`src/app/api/payments/route.ts`)

Payments support CRUD with extra charges, but finalized payments (PAID/REFUNDED) are immutable.

```ts
if (['PAID', 'REFUNDED'].includes(String(existingPayment.status).toUpperCase())) {
  return NextResponse.json(
    { success: false, error: 'Finalized payments are immutable and cannot be updated' },
    { status: 409 },
  );
}

// DELETE is completely disabled:
export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Payments cannot be deleted' }, { status: 405 });
}
```

---

## 12. Invoice Generation + Email (`src/app/api/payments/[id]/send-invoice/route.ts`)

When sending an invoice, the system:
1. Fetches the payment with nested guest and reservation
2. Loads all charges (reservations, food orders, activity bookings, payment extra items, payment history)
3. Builds a `BillingSummary` via the billing module
4. Generates a PDF using `jsPDF` with full itemized charges
5. Sends the PDF as an email attachment via Resend

```ts
const billingSummary = buildBillingSummary({
  roomCharges: reservations.map(r => ({ amount: r.totalAmount, label: `Reservation ${r.reservationId}` })),
  activityCharges: activityBookings.map(b => ({ amount: b.amount, label: b.activity })),
  foodOrders: foodOrders.map(o => ({ id: o.id, orderId: o.orderId, total: o.total, ... })),
  extraCharges: extraCharges.map(c => ({ category: c.category, amount: c.amount, label: c.label })),
  payments: payments.map(p => ({ amount: p.amount, status: p.status })),
});

const generatedPdfBase64 = buildInvoicePdfBase64({ invoiceReference, guestName, items: billingSummary.items, ... });
await sendInvoiceEmail({ to: guest.email, guestName, invoiceReference, pdfBase64: generatedPdfBase64 });
```

---

## 13. PDF Invoice (`src/lib/invoice-pdf.ts`)

Uses `jsPDF` to generate a professional A4 invoice PDF with:
- Header with La Pirogue branding
- Guest and reservation details
- Itemized charges table with category, label, amount
- Totals summary (total charges, total paid, balance due)
- Payment history

```ts
export function buildInvoicePdfBase64(input: InvoicePdfInput) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  pdf.setFillColor(29, 58, 50);
  pdf.rect(0, 0, 595, 96, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('La Pirogue Hotel', margin, 32);
  pdf.text(`Invoice reference: ${input.invoiceReference}`, margin, 68);
  // ... itemized table, totals, payment history
}
```

---

## 14. Billing Engine (`src/lib/billing.ts`)

Aggregates charges from all sources (rooms, F&B, activities, extra charges) and computes totals, paid amounts, and balance due.

```ts
export function buildBillingSummary({ roomCharges, activityCharges, foodOrders, extraCharges, payments }) {
  const items: BillingLineItem[] = [];
  const totals = { 'Room charges': 0, 'Food & Beverage orders': 0, 'Tours and activities': 0, ... };

  roomCharges.forEach(item => { totals['Room charges'] += item.amount; items.push({...}); });
  activityCharges.forEach(item => { totals['Tours and activities'] += item.amount; items.push({...}); });
  foodOrders.forEach(order => {
    if (order.subtotal > 0) totals['Food & Beverage orders'] += order.subtotal;
    if (order.serviceCharge > 0) totals['Taxes and service charges'] += order.serviceCharge;
    if (order.taxAmount > 0) totals['Taxes and service charges'] += order.taxAmount;
  });
  extraCharges.forEach(item => { totals[item.category] += item.amount; });

  const totalCharges = Object.values(totals).reduce((s, a) => s + a, 0);
  const totalPaid = payments.reduce((sum, p) => p.status === 'REFUNDED' ? sum - p.amount : sum + p.amount, 0);
  const balanceDue = Math.max(totalCharges - totalPaid, 0);

  return { items, totals, totalCharges, totalPaid, balanceDue, status };
}
```

---

## 15. Email System (`src/lib/mailer.ts`)

Uses **Resend** for all transactional emails. Four email types:

1. **Guest Portal Invitation** — sent after reservation creation, includes guest details and registration link
2. **Staff Invitation** — sent when staff are onboarded, includes employee code and registration link
3. **Payment Confirmation** — sent after payment is recorded
4. **Invoice Email** — sends PDF invoice as attachment
5. **Password Reset** — sends reset link

```ts
export async function sendInvoiceEmail({ to, guestName, invoiceReference, pdfBase64 }) {
  const response = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Invoice ${invoiceReference} - La Pirogue Hotel`,
    html: `<p>Your invoice is attached as a PDF.</p>`,
    attachments: [{ filename: `invoice-${invoiceReference}.pdf`, content: pdfBase64 }],
  });
}
```

---

## 16. Sustainability — Eco Points Dashboard (`src/app/api/sustainability/route.ts`)

Aggregates eco-point data across guests, computes trends (30-day comparison), leaderboard (top 5), activity distribution, and 6-month monthly trend.

```ts
const [eventsResult, tiersResult, activitiesResult] = await Promise.all([
  supabase.from('guest_eco_point_events').select('..., sustainability_activities(name, color), guests(first_name, last_name)'),
  supabase.from('eco_tiers').select('name, min_points, sort_order'),
  supabase.from('sustainability_activities').select('id, name, color').eq('is_active', true),
]);

const totalPoints = events.reduce((sum, row) => sum + row.points, 0);
const { current: recentEvents, previous: priorEvents } = splitByPeriod(events);

return {
  summary: {
    totalEcoPoints, totalEcoPointsTrend: percentChange(recentPoints, priorPoints),
    activeParticipants, carbonOffsetKg, ...
  },
  leaderboard: [...guestTotals.entries()].sort((a, b) => b.points - a.points).slice(0, 5),
  activityDistribution,
  monthlyTrend: lastSixMonths().map(m => ({ month: m.label, points: 0 })),
};
```

---

## Summary of Key Patterns

| Pattern | Usage |
|---|---|
| **Server Components for auth** | Dashboard layout checks session server-side |
| **Client Components for interactivity** | All pages use `'use client'` with SWR |
| **SWR for client data fetching** | `useApi<T>` hook wraps SWR with `ApiResponse` envelope |
| **Supabase Admin (service role)** | All API routes use `getSupabaseAdmin()` to bypass RLS |
| **Zod validation** | All API routes validate request bodies with Zod schemas |
| **Parallel Supabase queries** | Dashboard (15 queries), GuestProfile (4 tables) |
| **Immutable payments** | Finalized payments cannot be edited or deleted |
| **Audit logging** | Reservation deletes are audited via `recordAuditLog` |
| **Email via Resend** | Portal invites, invoices, password resets |
| **PDF via jsPDF** | Invoices generated as A4 PDFs with full billing details |
| **Route groups** | `(auth)` and `(dashboard)` groups for different layouts |
| **CSS variables** | Theme via `globals.css` custom properties, Tailwind utility classes |
