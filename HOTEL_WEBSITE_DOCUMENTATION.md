# La Pirogue Hotel — Admin Portal Documentation

**Technology Stack**
- **Framework:** Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS, Framer Motion
- **State/Data:** SWR (client-side fetching), React Hook Form + Zod (forms/validation)
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Auth:** Supabase SSR (server-side session via cookies)
- **Email:** Resend (transactional emails)
- **PDF:** jsPDF (invoice generation)
- **Charts:** Recharts (dashboard analytics)
- **Notifications:** Sonner (toast notifications)
- **Icons:** Lucide React

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [System Architecture](#2-system-architecture)
3. [Authentication & Roles](#3-authentication--roles)
4. [Navigation & Pages](#4-navigation--pages)
5. [API Endpoints](#5-api-endpoints)
6. [Middleware & Auth Guards](#6-middleware--auth-guards)
7. [Database Schema](#7-database-schema)
8. [Business Logic Flows](#8-business-logic-flows)
9. [Reusable Components](#9-reusable-components)
10. [Email System](#10-email-system)
11. [Audit System](#11-audit-system)
12. [Environment Configuration](#12-environment-configuration)
13. [Database Migrations](#13-database-migrations)

---

## 1. Project Structure

```
Hotel/
├── middleware.ts                          # Auth middleware (Supabase SSR)
├── package.json                           # la-pirogue-enterprise v1.0.0
├── tsconfig.json                          # strict: true
├── tailwind.config.ts
├── .env                                   # Environment variables
├── .env.local                             # Local overrides
├── scripts/
│   └── run_migration.mjs                  # Database migration runner
├── supabase/
│   ├── migrations/                        # Migration SQL files
│   ├── laprogue_final.sql                 # Consolidated base schema
│   ├── laprogue_v2_migration.sql          # V2 improvements
│   └── supabase_migration_v7.sql          # V7 guest app improvements
└── src/
    ├── app/
    │   ├── globals.css                    # Tailwind + CSS variables
    │   ├── layout.tsx                     # Root layout (Inter font + Sonner)
    │   ├── (auth)/                        # Auth route group (no sidebar)
    │   │   ├── login/page.tsx
    │   │   ├── register/page.tsx
    │   │   ├── forgot-password/page.tsx
    │   │   └── reset-password/page.tsx
    │   ├── (dashboard)/                   # Dashboard route group (sidebar)
    │   │   ├── layout.tsx                 # Sidebar + Topbar layout
    │   │   ├── page.tsx                   # Role-based dashboard
    │   │   ├── guests/
    │   │   ├── rooms/
    │   │   ├── reservations/
    │   │   ├── payments/
    │   │   ├── activities/
    │   │   ├── food-beverage/
    │   │   ├── notifications/
    │   │   ├── messages/
    │   │   ├── feedback/
    │   │   ├── schedule/
    │   │   ├── sustainability/
    │   │   ├── reports/
    │   │   ├── settings/
    │   │   ├── departments/
    │   │   ├── managers/
    │   │   ├── receptionists/
    │   │   ├── hotel-information/
    │   │   └── invoice/
    │   ├── api/                           # 40+ API route handlers
    │   ├── dining/page.tsx                # Public dining menu
    │   └── emergency-contacts/page.tsx    # Public emergency contacts
    ├── components/
    │   ├── Layout.tsx                     # Authenticated layout
    │   ├── Sidebar.tsx                    # Role-based navigation
    │   ├── Topbar.tsx                     # User info + notifications
    │   ├── ProtectedPage.tsx              # Auth gate wrapper
    │   ├── DataTablePage.tsx              # Generic data table
    │   ├── CrudDataTablePage.tsx          # CRUD data table
    │   ├── DashboardDataPage.tsx          # Dashboard analytics
    │   ├── PageHeader.tsx
    │   ├── StatCard.tsx
    │   ├── StatusBadge.tsx
    │   ├── Modal.tsx
    │   ├── ConfirmDialog.tsx
    │   ├── AppToaster.tsx
    │   ├── board/                         # Room assignment board
    │   ├── feedback/
    │   ├── food-beverage/
    │   ├── forms/                         # Form pages
    │   ├── modals/                        # CRUD modals
    │   ├── payments/
    │   ├── pickers/                       # Search/select pickers
    │   ├── settings/
    │   ├── sustainability/
    │   └── ui/                            # Primitive UI components
    ├── contexts/
    │   └── SidebarContext.tsx
    ├── hooks/
    │   └── useApi.ts                      # SWR-based API hooks
    ├── lib/
    │   ├── supabase.ts                    # Admin client (service role)
    │   ├── supabase-browser.ts            # Browser client singleton
    │   ├── supabase-server.ts             # Server-side helpers
    │   ├── auth-server.ts                 # getServerSession()
    │   ├── api-response.ts                # Response helpers
    │   ├── audit.ts                       # Audit logging
    │   ├── mailer.ts                      # Email templates
    │   ├── resend.ts                      # Resend client
    │   ├── billing.ts                     # Billing aggregation
    │   ├── invoice-pdf.ts                 # PDF generation
    │   ├── eco-points.ts                  # Sustainability engine
    │   ├── guest-profile.ts               # Full guest profile loader
    │   ├── guests.ts                      # Guest mapper
    │   ├── date-utils.ts
    │   ├── countries.ts
    │   ├── phone.ts
    │   ├── activities.ts
    │   └── upload-image.ts
    └── types/
        └── index.ts                       # All TypeScript types
```

---

## 2. System Architecture

### Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                    ADMIN PORTAL (Next.js 16)                │
│                                                             │
│  Pages (Server Components)                                  │
│    ├── Auth pages (/login, /register, ...)                  │
│    ├── Dashboard pages (/guests, /rooms, ...)              │
│    └── Public pages (/dining, ...)                          │
│                                                             │
│  API Routes (/api/*)                                        │
│    ├── Auth (/auth/login, /auth/me, ...)                   │
│    ├── CRUD (/rooms, /guests, /reservations, ...)          │
│    ├── Operations (/dashboard, /payments/send-invoice, ...)│
│    └── Public (/dining, /health, ...)                      │
│                                                             │
│  Middleware (Edge Runtime)                                  │
│    ├── Public API passthrough                               │
│    ├── Auth route redirects                                 │
│    ├── Protected route auth check                           │
│    └── Guest user rejection                                 │
└──────────────────────┬─────────────────────────────────────┘
                       │
          Supabase SSR (cookie-based session)
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│                    SUPABASE                                │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────┐ │
│  │  Auth   │  │PostgreSQL│  │ Storage │  │  Realtime   │ │
│  │ (users) │  │ 30+ tbls │  │ buckets │  │messages/not.│ │
│  └─────────┘  └──────────┘  └─────────┘  └─────────────┘ │
│                                                             │
│  RPC Functions:                                             │
│  get_available_rooms, create_guest_profile,                 │
│  get_guest_active_reservation, create_mobile_reservation,  │
│  book_activity_pre_checkin, lookup_guest_by_booking,       │
│  link_guest_auth, auto_complete_schedule_items,            │
│  increment_eco_points, get_guest_eco_points,                │
│  get_eco_leaderboard, create_pending_reservation,           │
│  verify_pending_reservation                                 │
└────────────────────────────────────────────────────────────┘
                       │
           Resend (transactional emails)
                       │
                       ▼
              SMTP / Email Delivery
```

### Data Flow Patterns

| Pattern | Usage | Example |
|---------|-------|---------|
| **Server Components** | Page rendering, initial data fetch | Dashboard stats, guest list |
| **SWR (client)** | Live data fetching with cache/revalidate | Room CRUD, reservation list |
| **API Routes** | All mutations + complex queries | `POST /api/reservations` |
| **Supabase Admin (server)** | Service-role operations (bypass RLS) | All API route database access |
| **Supabase Browser (client)** | Anon-key operations for public pages | Public dining menu |
| **Supabase SSR** | Cookie-based auth in middleware/pages | Session verification |

---

## 3. Authentication & Roles

### Role Hierarchy

```
ADMIN ─── System configuration, staff management
  │
MANAGER ─── Full operational control (guests, rooms, reservations,
  │         payments, activities, food, feedback, sustainability)
  │
RECEPTIONIST ─── Front-desk operations (dashboard, guests, rooms,
                room assignment, reservations, payments)
```

### Staff Login Flow

1. Staff navigates to `/login`
2. Submits email + password via `POST /api/auth/login`
3. Backend validates:
   - Supabase Auth `signInWithPassword()` succeeds
   - User exists in `profiles` table with role `ADMIN`/`MANAGER`/`RECEPTIONIST`
   - `is_active` is `true` (blocked accounts rejected with 403)
   - User is NOT a guest (guests rejected with "Guests must access via the mobile app")
4. On success: Supabase session cookies set, redirect to dashboard
5. On failure: Error message shown on login form

### Staff Registration Flow (Invitation)

1. Admin creates a Manager or Receptionist via the staff management page
2. Backend generates a JWT invitation token (HS256, 48-hour expiry): `{ staffId: uuid }`
3. Invitation email sent via Resend with link: `/register?token=xxx&role=MANAGER`
4. Staff clicks link, sets password
5. `POST /api/staff/register` verifies JWT, creates/linked Supabase auth user, creates profile

### Guest Registration (Portal Invitation)

1. Manager creates a guest record → guest gets `account_status: 'PENDING'`
2. Portal invitation email sent with registration link
3. `POST /api/guests/register-account` creates Supabase auth user, links to guest record
4. DB trigger automatically sets `account_status = 'ACTIVE'` when `auth_id` is set
5. Guests are blocked from the admin portal by middleware

### Guest Account Statuses

| Status | Description | Can Book? | Middleware |
|--------|------------|-----------|------------|
| `PENDING` | Awaiting email verification | No | Blocked from admin |
| `ACTIVE` | Verified, can make reservations | Yes | Blocked from admin |
| `FROZEN` | Temporarily suspended (e.g., payment issues) | No | Blocked from admin |
| `BANNED` | Permanently banned | No | Blocked from admin |

### Session Management

- **Middleware** (`middleware.ts`): Uses `@supabase/ssr` `createServerClient` with cookie-based auth
- **Server Components**: `getServerSession()` from `lib/auth-server.ts` reads cookies to get current user
- **API Routes**: `createRouteHandlerSupabaseContext()` from `lib/supabase-server.ts` to get authenticated session

---

## 4. Navigation & Pages

### Sidebar Navigation (Role-Based)

| Admin | Manager | Receptionist |
|-------|---------|--------------|
| Dashboard | Dashboard | Dashboard |
| Departments | Guests | Guests |
| Managers | Rooms → Room Assignment | Rooms → Room Assignment |
| Settings | Reservations → Calendar, New | Room Board |
| | Payments | Reservations |
| | Activities & Tours → Calendar | Payments |
| | Food & Beverage → Orders | Messages |
| | Receptionists | Notifications |
| | Sustainability | Schedule |
| | Guest Feedback | |
| | Hotel Information | |
| | Settings | |

### Page Inventory

#### Auth Pages (no sidebar)

| Route | File | Purpose |
|-------|------|---------|
| `/login` | `(auth)/login/page.tsx` | Staff email/password login |
| `/register` | `(auth)/register/page.tsx` | Staff registration from invitation |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | Password reset request |
| `/reset-password` | `(auth)/reset-password/page.tsx` | Set new password |

#### Dashboard Pages (with sidebar)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `(dashboard)/page.tsx` | Role-based dashboard with analytics |
| `/guests` | `(dashboard)/guests/page.tsx` | Guest list with search/filter/CRUD |
| `/guests/[id]` | `(dashboard)/guests/[id]/page.tsx` | Full guest profile (stays, bookings, orders, payments, billing) |
| `/rooms` | `(dashboard)/rooms/page.tsx` | Room management CRUD |
| `/rooms/assign` | `(dashboard)/rooms/assign/page.tsx` | Kanban room assignment board |
| `/reservations` | `(dashboard)/reservations/page.tsx` | Reservation list |
| `/reservations/calendar` | `(dashboard)/reservations/calendar/page.tsx` | Calendar view |
| `/reservations/new` | `(dashboard)/reservations/new/page.tsx` | New reservation form |
| `/payments` | `(dashboard)/payments/page.tsx` | Payment list |
| `/payments/[id]` | `(dashboard)/payments/[id]/page.tsx` | Payment detail + invoice send |
| `/activities` | `(dashboard)/activities/page.tsx` | Activities & tours CRUD |
| `/activities/calendar` | `(dashboard)/activities/calendar/page.tsx` | Activity calendar |
| `/activities/new` | `(dashboard)/activities/new/page.tsx` | Create new activity |
| `/food-beverage` | `(dashboard)/food-beverage/page.tsx` | Menu item CRUD |
| `/food-beverage/orders` | `(dashboard)/food-beverage/orders/page.tsx` | Food orders list |
| `/food-beverage/orders/new` | `(dashboard)/food-beverage/orders/new/page.tsx` | Create food order |
| `/notifications` | `(dashboard)/notifications/page.tsx` | System notifications |
| `/messages` | `(dashboard)/messages/page.tsx` | Guest messaging |
| `/feedback` | `(dashboard)/feedback/page.tsx` | Guest feedback/reviews |
| `/schedule` | `(dashboard)/schedule/page.tsx` | Weekly guest schedule |
| `/sustainability` | `(dashboard)/sustainability/page.tsx` | Eco-points dashboard |
| `/reports` | `(dashboard)/reports/page.tsx` | Reports overview |
| `/settings` | `(dashboard)/settings/page.tsx` | Staff profile settings |
| `/departments` | `(dashboard)/departments/page.tsx` | Department CRUD (admin only) |
| `/managers` | `(dashboard)/managers/page.tsx` | Manager list (admin only) |
| `/managers/[id]` | `(dashboard)/managers/[id]/page.tsx` | Manager detail |
| `/receptionists` | `(dashboard)/receptionists/page.tsx` | Receptionist list (manager) |
| `/receptionists/[id]` | `(dashboard)/receptionists/[id]/page.tsx` | Receptionist detail |
| `/hotel-information` | `(dashboard)/hotel-information/page.tsx` | Edit hotel about content, services, emergency contacts |
| `/invoice` | `(dashboard)/invoice/page.tsx` | Invoice viewer |

#### Public Pages (no auth)

| Route | File | Purpose |
|-------|------|---------|
| `/dining` | `dining/page.tsx` | Public restaurant menu (anonymous) |
| `/emergency-contacts` | `emergency-contacts/page.tsx` | Emergency contact numbers |

---

## 5. API Endpoints

### Authentication

| Method | Endpoint | Purpose | Key Logic |
|--------|----------|---------|-----------|
| POST | `/api/auth/login` | Staff login | Validates Supabase Auth, checks `profiles` role (ADMIN/MANAGER/RECEPTIONIST), rejects guests (403) and inactive accounts, sets auth cookies |
| POST | `/api/auth/logout` | Staff logout | Signs out via Supabase, clears cookies |
| GET | `/api/auth/me` | Current user session | Reads session, builds rich User object with nested roles from `profiles`/`managers`/`receptionists` tables, 60s in-memory cache, also handles PUT for profile updates |
| POST | `/api/auth/forgot-password` | Password reset | Generates recovery link, sends email via Resend |
| GET | `/api/auth/verify` | Auth status check | Cookie-based check, returns `{authenticated: boolean}` |
| POST | `/api/auth/password-sync` | Password update | Admin-level via `supabase.auth.admin.updateUserById` |
| POST | `/api/staff/register` | Staff registration | Verifies JWT invitation token, creates/links auth user, creates profile |

### Dashboard

| Method | Endpoint | Purpose | Response Data |
|--------|----------|---------|---------------|
| GET | `/api/dashboard` | Analytics dashboard | Role-specific: Admin→ managers/depts/audit. Manager→ room stats, occupancy, guests, revenue, feedback. Receptionist→ room breakdown, today's check-ins/outs. 30s cache |

### Room Management (`/api/rooms`)

| Method | Purpose |
|--------|---------|
| GET | List rooms with pagination, search, status/type filters. Supports `checkIn`/`checkOut` for availability queries (excludes rooms with conflicting active reservations) |
| POST | Create room (validates `roomSchema`) |
| PUT | Update room |
| DELETE | Soft-delete blocked if active reservations or food orders reference the room (referential integrity check) |

### Reservation Management (`/api/reservations`)

| Method | Purpose |
|--------|---------|
| GET | List reservations with guest/room join, `reservation_id` search |
| POST | Create reservation: validates guest account status (FROZEN/BANNED/PENDING rejected), checks date conflicts (double-booking prevention), auto-sends confirmation email |
| PUT | Update reservation: validates check-in date, checks date conflicts, syncs guest status, sends cancellation email if cancelled |
| DELETE | Cancel reservation (status=`CANCELLED`), updates guest status, records audit log, DB trigger cascades cancellations to bookings/orders/items |
| POST | `/request-verification` — Initiate OTP flow for mobile booking |
| POST | `/verify-otp` — Verify OTP code and confirm mobile reservation |
| POST | `/resend-otp` — Resend OTP verification code |
| POST | `/confirm-email` — Resend confirmation email |
| GET | `/calendar` — Calendar-view reservation data |

### Guest Management (`/api/guests`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/guests` | List guests with pagination, search, status/accountStatus filters, joins active reservation for current stay info |
| POST | `/api/guests` | Create guest, auto-generates `guestId` (`G-{timestamp}{suffix}`), sets `account_status=PENDING` |
| PUT | `/api/guests` | Update guest (only MANAGER can update `account_status`) |
| DELETE | `/api/guests` | **Rejected** — guests are never deleted per financial audit policy |
| GET | `/api/guests/[id]` | Get single guest |
| PATCH | `/api/guests/[id]` | Partial update: check-in validation, manager-only VIP/status changes, syncs reservation status |
| DELETE | `/api/guests/[id]` | Delete guest (with audit log) |
| PUT | `/api/guests/[id]/status` | Update account status (ACTIVE/FROZEN/BANNED). Banning auto-cancels all active reservations |
| GET | `/api/guests/register-account` | Get guest invitation details |
| POST | `/api/guests/register-account` | Create guest auth account (creates Supabase user, links to guest) |
| GET | `/api/guests/[id]/profile` | Full guest profile (stays, bookings, orders, payments, billing summary) |
| POST | `/api/guests/[id]/resend-portal` | Resend portal invitation email |

### Payment Management (`/api/payments`)

| Method | Purpose |
|--------|---------|
| GET | List payments with guest/reservation joins |
| POST | Create payment, optionally with extra charge items (transport, laundry, purchases) |
| PUT | Update payment (blocks updates on finalized PAID/REFUNDED payments) |
| DELETE | **Rejected** — payments are immutable |
| POST | `/api/payments/[id]/send-invoice` — Generate and send invoice PDF via email (jsPDF) |

### Activity Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST/PUT/DELETE | `/api/activities` | CRUD for activities/tours |
| GET/POST/PUT/DELETE | `/api/activities/book` | CRUD for activity bookings. POST: validates 10-min cutoff, checks active reservation, validates date within stay, awards eco-points on COMPLETED |

### Dining / Food Orders

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST/PUT/DELETE | `/api/menu-items` | CRUD for menu items |
| GET/POST/PUT/DELETE | `/api/food-orders` | CRUD for food orders. POST: requires CHECKED_IN status, auto-fills room from active reservation |
| GET | `/api/dining` | Public menu (anonymous, only available items, uses non-admin key) |

### Staff Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST/PUT/DELETE | `/api/departments` | Department CRUD (DELETE blocked if staff assigned — FK error 23503) |
| GET/POST/PUT | `/api/managers` | Manager CRUD. POST: generates JWT invitation token (48h), sends email |
| GET/POST/PUT | `/api/receptionists` | Receptionist CRUD. POST: generates JWT invitation token, sends email |
| GET/POST/PUT/DELETE | `/api/roles` | Role CRUD |

### Notifications & Messages

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST/DELETE | `/api/notifications` | CRUD + mark-read (single or bulk) |
| GET/POST/PATCH/DELETE | `/api/messages` | Staff-guest messaging. POST: creates notification for guest if sent by staff |

### Schedule & Feedback

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST/PATCH | `/api/schedule` | Weekly schedule aggregation (6 tables), create item (time-constrained 07:00-22:00), auto-complete/mark complete |
| GET | `/api/feedback` | Paginated feedback with summary stats (average rating, distribution, response rate, trends) |

### Hotel Information

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/PUT | `/api/content/about` | Manage about page content |
| GET/POST/PUT/DELETE | `/api/hotel-services` | Hotel services CRUD |
| GET/POST/PUT/DELETE | `/api/hotel-service-categories` | Service categories CRUD |
| GET/POST/PUT/DELETE | `/api/emergency-contacts` | Emergency contacts CRUD |

### Sustainability

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/sustainability` | Dashboard data: total points, leaderboard, activity distribution, monthly trends |
| POST | `/api/sustainability/award` | Award eco-points to a guest |
| DELETE | `/api/sustainability/award` | Revoke eco-points by source |

### Additional

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/reports` | Simple aggregate metrics (guests, rooms, reservations, revenue, food revenue) |
| PUT | `/api/settings/profile` | Update staff profile (name, email, phone, avatar, address) |
| PUT | `/api/settings/password` | Change password (requires current password verification) |

---

## 6. Middleware & Auth Guards

### Middleware (`middleware.ts`)

Uses `@supabase/ssr` `createServerClient` for cookie-based auth at the edge.

**Route Classification:**

| Route Type | Examples | Auth Required? |
|------------|----------|----------------|
| Public API | `/api/auth/login`, `/api/auth/me`, `/api/reservations`, `/api/rooms`, `/api/dining` | No |
| Auth Routes | `/login`, `/forgot-password`, `/reset-password` | Redirects to `/` if already authenticated |
| Public Routes | `/register`, `/dining` | No |
| Protected API | All other `/api/*` routes | Yes (401 if not authenticated, 403 if guest user) |
| Protected Pages | All dashboard routes | Yes (redirects to `/login?next=...`) |

**Guest Blocking:**
- The middleware checks if the authenticated user has an entry in the `guests` table
- If yes, they are signed out and redirected to `/login` with a 403 (API) or redirect (page)
- This prevents mobile app guests from accessing the admin portal

**CORS:**
- All API responses get `Access-Control-Allow-Origin: *` headers
- OPTIONS preflight handler returns 204 with CORS headers

### Component-Level Guards

**`ProtectedPage` component**: Wraps dashboard page content, shows loading state while auth resolves.

**Server-side: `getServerSession()`**: Used in page/layout server components to get current user and check role permissions before rendering.

---

## 7. Database Schema

### Core Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `profiles` | `auth_id` (PK, FK→auth.users), `full_name`, `email`, `role` (user_role enum: ADMIN/MANAGER/RECEPTIONIST/GUEST), `is_active`, `avatar_url` | Auth identity for staff |
| `guests` | `id` (PK), `auth_id` (UNIQUE), `guest_id` (UNIQUE, format: `G-...`), `first_name`, `last_name`, `email`, `phone`, `nationality`, `passport`, `status`, `account_status` (PENDING/ACTIVE/FROZEN/BANNED), `vip`, `gender`, `image_path`, `fcm_token` | Guest profiles |
| `rooms` | `id` (PK), `room_number` (UNIQUE), `type` (STANDARD/DELUXE/SUITE/VILLA), `floor`, `capacity`, `price`, `status` (AVAILABLE/OCCUPIED/CLEANING/MAINTENANCE), `amenities` (text[]), `image_path`, `image_paths` (text[]) | Room inventory |
| `reservations` | `id` (PK), `reservation_id` (UNIQUE, auto-generated), `guest_id` (FK), `room_id` (FK), `check_in`, `check_out`, `adults`, `children`, `status` (RESERVED/CONFIRMED/CHECKED_IN/CHECKED_OUT/CANCELLED/NO_SHOW), `total_amount`, `origin` (MOBILE_APP/RECEPTION_DESK/MANAGER_PORTAL), `created_by_name` | Booking records |
| `payments` | `id` (PK), `payment_id` (UNIQUE), `guest_id` (FK), `reservation_id` (FK), `amount`, `method` (CASH/CARD/BANK_TRANSFER/ONLINE), `status` (PENDING/COMPLETED/FAILED/REFUNDED/PAID/PARTIALLY_PAID), `reference` | Payment records |
| `payment_extra_items` | `id` (PK), `payment_id` (FK), `guest_id` (FK), `category`, `label`, `amount` | Additional charges |
| `menu_items` | `id` (PK), `name`, `category`, `description`, `price`, `preparation_minutes`, `is_available`, `image_path` | Dining menu |
| `food_orders` | `id` (PK), `order_id` (UNIQUE), `guest_id` (FK), `room_id` (FK), `items` (jsonb), `subtotal`, `service_charge`, `tax_amount`, `total`, `status` (PENDING/PREPARING/SERVED/CANCELLED), `origin` | Food orders |
| `activities` | `id` (PK), `name`, `category`, `description`, `price`, `duration`, `capacity`, `meeting_point`, `status` (ACTIVE/INACTIVE/FULL), `image_path` | Tours/activities |
| `activity_bookings` | `id` (PK), `activity_id` (FK), `guest_id` (FK), `booking_date`, `booking_time`, `participants`, `status`, `origin`, `created_by_name` | Activity bookings |
| `messages` | `id` (PK), `guest_id` (FK), `sender_type` ('guest'/'staff'), `content`, `is_read`, `file_url`, `file_name`, `file_type`, `file_size` | Guest-staff chat |
| `notifications` | `id` (PK), `guest_id` (FK), `title`, `message`, `category`, `is_read` | Push/in-app notifications |
| `guest_feedback` | `id` (PK), `guest_id` (FK), `rating`, `category`, `comment`, `staff_response`, `responded_at` | Guest reviews |
| `managers` | `id` (PK), `manager_id` (UNIQUE), `auth_id` (UNIQUE, FK→auth.users), `first_name`, `last_name`, `email`, `department_id` (FK), `is_active`, `image_path` | Manager profiles |
| `receptionists` | `id` (PK), `employee_code` (UNIQUE), `auth_id` (UNIQUE, FK→auth.users), `first_name`, `last_name`, `email`, `department_id` (FK), `manager_id` (FK), `is_active` | Receptionist profiles |
| `departments` | `id` (PK), `name` (UNIQUE), `description`, `is_active` | Hotel departments |
| `pending_reservations` | `id` (PK), `email`, `guest_id` (FK), `room_id` (FK), `check_in`, `check_out`, `adults`, `children`, `total_amount`, `verification_token` (UNIQUE), `expires_at` (30 min), `verified_at` | OTP verification queue |
| `audit_logs` | `id` (PK), `table_name`, `record_id`, `action` (INSERT/UPDATE/DELETE/BLOCK/UNBLOCK), `actor_id`, `previous_data` (jsonb), `new_data` (jsonb) | Change tracking |
| `site_content_pages` | `id` (PK), `slug` (UNIQUE), `title`, `subtitle`, `body`, `highlights` (jsonb), `metrics` (jsonb), `image_path`, `is_active` | CMS for hotel info |
| `hotel_services` | `id` (PK), `category_id` (FK), `name`, `description`, `phone_number`, `email`, `hours_text`, `location`, `image_url`, `sort_order`, `is_available` | Hotel services directory |
| `emergency_contacts` | `id` (PK), `name`, `description`, `phone_number`, `icon_name`, `is_24h`, `display_order` | Emergency numbers |
| `guest_schedule_items` | `id` (PK), `guest_id` (FK), `title`, `item_type`, `source_module`, `source_record_id`, `start_at`, `end_at`, `status`, `color` | Schedule/itinerary |
| `itinerary_events` | `id` (PK), `guest_id` (FK), `title`, `category`, `description`, `location`, `start_at`, `end_at`, `status` | Events |
| `sustainability_activities` | `id` (PK), `name`, `category`, `color`, `default_points`, `carbon_offset_kg`, `is_active` | Eco-actions |
| `eco_points_balance` | `id` (PK), `guest_id` (FK, UNIQUE), `balance`, `tier` | Points ledger |
| `guest_eco_point_events` | `id` (PK), `guest_id` (FK), `activity_id` (FK), `source_type`, `source_label`, `points`, `carbon_offset_kg`, `metadata` (jsonb) | Points history |
| `eco_tiers` | `id` (PK), `name`, `min_points`, `sort_order` | Points tiers |

### Key Enums

| Enum | Values | Used By |
|------|--------|---------|
| `user_role` | ADMIN, MANAGER, RECEPTIONIST, GUEST | `profiles` |
| `reservation_status` | RESERVED, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW | `reservations` |
| `guest_status` | RESERVED, CHECKED_IN, CHECKED_OUT, CANCELLED | `guests` |
| `room_type` | STANDARD, DELUXE, SUITE, VILLA | `rooms` |
| `room_status` | AVAILABLE, OCCUPIED, CLEANING, MAINTENANCE | `rooms` |
| `payment_status` | PENDING, COMPLETED, FAILED, REFUNDED, PAID, PARTIALLY_PAID | `payments` |
| `order_origin` | MOBILE_APP, RECEPTION_DESK, MANAGER_PORTAL | `reservations`, `activity_bookings` |
| `activity_status` | ACTIVE, INACTIVE, FULL | `activities` |

### Key Database Triggers

| Trigger | Function | Behavior |
|---------|----------|----------|
| `trg_reservation_cancellation` | `handle_reservation_cancellation()` | On reservation status change to CANCELLED: auto-cancels activity bookings, schedule items, itinerary events, food orders, and guest orders within reservation dates. Also updates guest status on CHECKED_IN/CHECKED_OUT |
| `trg_guest_auth_active` | `set_guest_active_on_auth_link()` | When `auth_id` is set on a guest record, auto-updates `account_status` to ACTIVE |

---

## 8. Business Logic Flows

### Reservation Lifecycle

```
Mobile App OTP Flow:
  Guest taps "Book" → POST /api/reservations/request-verification
    → RPC: create_pending_reservation() → pending_reservations
    → Supabase Auth: signInWithOtp() → sends 6-digit code via email
    → Guest enters code → POST /api/reservations/verify-otp
    → Supabase Auth: verifyOtp()
    → RPC: verify_pending_reservation() → reservations (status: RESERVED)
    → Confirmation email sent via Resend

Desk Booking Flow:
  Staff creates via web form → POST /api/reservations
    → Validates guest account (not FROZEN/BANNED/PENDING)
    → Checks date conflicts (double-booking prevention)
    → Inserts reservation (status: CONFIRMED)
    → Sends confirmation email

Status Progression:
  RESERVED → CONFIRMED → CHECKED_IN → CHECKED_OUT
                                                    ↘ CANCELLED / NO_SHOW
```

### Check-In Flow

1. Reservation must be in `CONFIRMED` or `RESERVED` status
2. Check-in date must be today or after (and before check-out date)
3. Staff updates via `PATCH /api/guests/[id]` or `PUT /api/reservations`
4. DB trigger updates guest status to `CHECKED_IN`
5. After check-in: guest can place food orders, book activities within stay dates, access room service, spa, and full schedule

### Check-Out Flow

1. Reservation status updated to `CHECKED_OUT`
2. Guest status updated to `CHECKED_OUT`
3. Final billing summary generated (room charges + F&B + activities + extras − payments)
4. Invoice can be sent via email with PDF attachment

### Cancellation Flow

1. Soft-delete via status = `CANCELLED` (reservations are never hard-deleted)
2. DB trigger auto-cancels all related bookings/orders within reservation dates:
   - Activity bookings → status `CANCELLED`
   - Schedule items → status `CANCELLED`
   - Itinerary events → status `CANCELLED`
   - Food orders (PENDING/PREPARING) → status `CANCELLED`
   - Guest orders (PENDING/CONFIRMED) → status `CANCELLED`
3. Guest status updated to `CANCELLED` if no other active reservations exist
4. Cancellation email sent to guest
5. Audit log recorded

### Room Assignment Board (Kanban)

The `RoomAssignmentBoard` component provides drag-and-drop assignment:
- **Columns by room status**: Available, Occupied, Cleaning, Maintenance
- **Cards**: Show room number, type, current guest name, check-in/out dates
- **Actions**: Assign guest to room, mark as cleaning, mark as maintenance
- Data sourced from rooms + active reservations joined

### Billing Summary

Aggregated from 5+ tables by `buildBillingSummary()` (`lib/billing.ts`):

```
Total Charges = Room Charges (reservations.total_amount)
              + Activity Charges (activity_bookings × activity.price)
              + F&B Charges (food_orders.subtotal + service_charge + tax)
              + Extra Charges (payment_extra_items)

Total Paid = SUM(payments.amount WHERE status = 'PAID'/'COMPLETED')

Balance Due = Total Charges − Total Paid
```

### Eco-Points System

- **Award triggers**: Activity booking marked COMPLETED, manual award by staff
- **Points lookup**: `sustainability_activities` table by matching name/category
- **Storage**: `guest_eco_point_events` (ledger) + `eco_points_balance` (current balance)
- **Leaderboard**: Top guests ranked by total points via RPC `get_eco_leaderboard()`
- **Charts**: Monthly trends + activity distribution on sustainability dashboard

### Activity Booking Rules

- **10-minute cutoff**: Bookings can only be modified/cancelled if more than 10 minutes before the activity start time
- **Pre-booking**: Guests with `RESERVED` status can pre-book activities within their stay dates
- **Capacity check**: Booking participants cannot exceed activity capacity
- **Eco-points**: Auto-awarded when booking status changes to COMPLETED, revoked if reverted

### Food Ordering Rules

- Guest must be `CHECKED_IN` to place food orders
- Room auto-filled from guest's active reservation
- Status workflow: `PENDING → PREPARING → SERVED → CANCELLED`
- Order cancellation cascades through DB trigger on reservation cancellation

---

## 9. Reusable Components

### Page Components

| Component | Purpose |
|-----------|---------|
| `DataTablePage` | Generic data table with search, pagination, status/type filters |
| `CrudDataTablePage` | Data table with create/edit/delete actions + modal integration |
| `DashboardDataPage` | Role-based dashboard (sub-components: `AdminDashboard`, `ManagerDashboard`, `ReceptionistDashboard`) |
| `PageHeader` | Page title with optional actions |
| `StatCard` | Dashboard metric card (icon, label, value, trend) |
| `StatusBadge` | Colored status badge (maps status → color) |

### Board Components

| Component | Purpose |
|-----------|---------|
| `RoomAssignmentBoard` | Kanban board with drag-and-drop room assignment |
| `RoomCard` | Room card (number, type, guest, dates) |
| `RoomGrid` | Room grid layout |
| `ArrivalsPanel` | Today's arrivals sidebar |

### Modal Components (CRUD)

| Component | Purpose |
|-----------|---------|
| `RoomModal` | Create/edit room form |
| `AddGuestModal` / `EditGuestModal` | Create/edit guest forms |
| `PaymentModal` | Create/edit payment form (with extra charges) |
| `MenuItemModal` | Create/edit menu item |
| `AddActivityModal` | Create/edit activity |
| `BookActivityModal` | Book activity for guest |
| `AddFoodOrderModal` | Create food order form |
| `AddReservationModal` | Create reservation form |
| `CreateScheduleItemModal` | Create schedule item |

### Picker Components

| Component | Purpose |
|-----------|---------|
| `GuestSearchPicker` | Search and select guest (with debounced search) |
| `RoomSearchPicker` | Search and select room |
| `GuestRoomSearchField` | Combined guest + room selector |

### UI Primitives

| Component | Purpose |
|-----------|---------|
| `Button` | Styled button (CVA-based variants) |
| `Card` | Card container with styling |
| `FormSection` | Form section wrapper with title |
| `LabeledTable` | Key-value display table |
| `PhoneField` | Mauritius phone input (+230 format) |
| `ImageUploadField` | Image upload with preview |
| `CountryComboboxField` | Country selector with search |
| `GuestNameCell` | Guest name with avatar and email |

### Layout Components

| Component | Purpose |
|-----------|---------|
| `Sidebar` | Role-based navigation panel (collapsible via `SidebarContext`) |
| `Topbar` | Top bar with search, user info, profile dropdown, logout |
| `Layout` | Sidebar + Topbar wrapper for dashboard pages |

---

## 10. Email System

### Configuration (`lib/resend.ts`)

```typescript
const resendApiKey = process.env.RESEND_API_KEY?.trim();
export const resend = new Resend(resendApiKey ?? '');
export const FROM_EMAIL = 'Lapirogue Hotel <no-reply@send.lapirogue-hotel.yunusu.me>';
```

### Email Templates (`lib/mailer.ts`)

All emails use HTML tables with inline styles for email client compatibility. They include the hotel logo and use the Resend SDK.

| Function | Trigger | Recipient | Content |
|----------|---------|-----------|---------|
| `sendGuestPortalInvitationEmail` | Guest created by staff | Guest | Portal registration link, guest ID, room number, check-in/out dates |
| `sendStaffInvitationEmail` | Manager/receptionist created | Staff | Registration link, employee code, role, 48h expiry |
| `sendPaymentConfirmationEmail` | Payment recorded | Guest | Amount, payment method, reference number |
| `sendInvoiceEmail` | Staff clicks "Send Invoice" | Guest | PDF attachment (jsPDF), invoice reference |
| `sendReservationConfirmationEmail` | Booking confirmed/cancelled | Guest | Full reservation details: room, dates, guests, pricing breakdown, tax, cancellation policy, payment status. Handles both CONFIRMED and CANCELLED states |
| `sendPasswordResetEmail` | Forgot password | Staff | Password reset link |

### PDF Invoice (`lib/invoice-pdf.ts`)

Generated using `jsPDF` with:
- Hotel logo and branding
- Invoice number and dates
- Guest information
- Itemized billing breakdown per category
- Subtotal, tax, and total
- Payment status and QR-like styling

---

## 11. Audit System

### Architecture (`lib/audit.ts`)

```typescript
// Record an audit entry
await recordAuditLog({
  tableName: 'reservations',     // Table affected
  recordId: id,                   // Record UUID
  action: 'UPDATE',               // INSERT | UPDATE | DELETE | BLOCK | UNBLOCK
  actorId: currentUser.id,        // Who did it
  previousData: beforeRow,        // Snapshot before
  newData: afterRow,              // Snapshot after
});
```

### Audit Coverage

| Table | Actions Audited |
|-------|----------------|
| `rooms` | DELETE |
| `reservations` | DELETE (cancel) |
| `departments` | INSERT, UPDATE, DELETE |
| `managers` | INSERT, UPDATE |
| `receptionists` | INSERT, UPDATE |
| `guests` | DELETE, status changes (BLOCK/UNBLOCK) |
| `menu_items` | DELETE |
| `activities` | DELETE |
| `notifications` | DELETE |
| `messages` | DELETE |
| `hotel_services` | DELETE |
| `hotel_service_categories` | DELETE |

### Audit Table Schema

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL,          -- INSERT/UPDATE/DELETE/BLOCK/UNBLOCK
  actor_id text,                  -- Who performed the action
  previous_data jsonb,            -- State before the change
  new_data jsonb,                 -- State after the change
  created_at timestamptz DEFAULT now()
);
```

---

## 12. Environment Configuration

### Required Variables (`Hotel/.env` / `.env.local`)

```env
NODE_ENV=development

NEXT_PUBLIC_APP_URL=http://localhost:3000

# Resend (email service)
RESEND_API_KEY=re_...

# Supabase (database + auth)
NEXT_PUBLIC_SUPABASE_URL=https://txalwdljaxltchcrauhp.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_URL=https://txalwdljaxltchcrauhp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### Variable Reference

| Variable | Used By | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `handleError()` in api-response | Controls error message detail (actual error in dev, generic in production) |
| `NEXT_PUBLIC_APP_URL` | `request-verification/route.ts`, password reset emails | Base URL for email redirect links |
| `RESEND_API_KEY` | `lib/resend.ts` | Resend API key for transactional email sending |
| `NEXT_PUBLIC_SUPABASE_URL` | middleware, `supabase-browser.ts` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | middleware, `supabase-browser.ts` | Supabase anonymous key (client-safe) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | middleware | Supabase publishable key for SSR cookie-based auth |
| `SUPABASE_URL` | `lib/supabase.ts` | Supabase URL for admin client |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase.ts`, `scripts/run_migration.mjs` | Supabase service role key (server-only, admin privileges, bypasses RLS) |
| `SUPABASE_PUBLISHABLE_KEY` | (unused in code) | Legacy variable |

### Running the Application

```bash
# Development
cd Hotel
npm run dev          # next dev (http://localhost:3000)

# Production build
npm run build        # next build + typecheck
npm run start        # next start

# Code quality
npm run lint         # ESLint
npm run type-check   # tsc --noEmit

# Database migration
node scripts/run_migration.mjs
```

---

## 13. Database Migrations

### Migration Files

| File | Key Changes |
|------|-------------|
| `supabase/cleanup_complete.sql` | Schema cleanup: sustainability_activities, eco_tiers, emergency_contacts, guest_eco_point_events tables |
| `supabase/laprogue_final.sql` | **Base consolidated schema** (820 lines): All core tables (profiles, guests, rooms, reservations, activities, menu_items, food_orders, messages, notifications, payments, guest_feedback, audit_logs, roles, site_content_pages, hotel_services, emergency_contacts, eco_points, itinerary_events), enums, RLS policies, audit trigger |
| `supabase/laprogue_v2_migration.sql` | V2 improvements: departments, managers, receptionists tables, registration_otps (superseded), guest_eco_point_events, guest lookup/link RPCs, room status update trigger, check-in enforcement triggers |
| `supabase/guest_app_migration_v3.sql` | Guest app features: created_by triggers for reservations/food/activities/payments, guest profile/reservation RPCs, food ordering RPC, activity booking RPC |
| `supabase/supabase_migration_v7.sql` | V7 guest app improvements: gender column, account_status, RESERVED enum value, cancellation triggers, get_available_rooms RPC, get_guest_active_reservation RPC, create_mobile_reservation RPC, create_guest_profile RPC, book_activity_pre_checkin RPC |
| `supabase/migrations/007_supabase_auth_verification.sql` | **Superseded by 008** — custom OTP approach |
| `supabase/migrations/008_pending_reservations_fix.sql` | **Active**: pending_reservations table, order_origin enum, origin columns on reservations/activity_bookings, create_pending_reservation/verify_pending_reservation/cleanup_expired_pending_reservations RPCs |

### Migration Runner (`scripts/run_migration.mjs`)

Connects to Supabase PostgreSQL (pooler or direct) using the service role key and runs SQL files sequentially:

```bash
node scripts/run_migration.mjs
```

Execution order:
1. `supabase/cleanup_complete.sql`
2. `supabase/laprogue_v2_migration.sql`
3. `supabase/supabase_migration_v7.sql`
4. `supabase/migrations/008_pending_reservations_fix.sql`

The runner splits SQL by semicolons while preserving `$$` dollar-quoted function bodies and runs each statement individually with error tolerance (expected errors from IF NOT EXISTS are caught and logged as warnings).

### Key RPC Functions Used by the System

| RPC | Purpose | Called By |
|-----|---------|-----------|
| `create_pending_reservation()` | Creates a pending reservation with verification token for OTP flow | `POST /api/reservations/request-verification` |
| `verify_pending_reservation()` | Verifies OTP and moves pending → actual reservation | `POST /api/reservations/verify-otp` |
| `cleanup_expired_pending_reservations()` | Cleanup for expired pending reservations (scheduled or manual) | Cron / manual |
| `create_mobile_reservation()` | Legacy direct mobile reservation (not used in current OTP flow) | Legacy |
| `create_guest_profile()` | Creates guest profile after mobile app email verification | Mobile app onboarding |
| `get_available_rooms()` | Room availability search with date range | Mobile app room search + admin portal |
| `get_guest_active_reservation()` | Returns guest's latest active reservation with room details | Mobile app + admin |
| `lookup_guest_by_booking()` | Anonymous booking lookup by reservation ID + last name | Mobile app (guest lookup) |
| `link_guest_auth()` | Links anonymous auth session to existing guest record | Mobile app |
| `book_activity_pre_checkin()` | Allows RESERVED guests to pre-book activities | Mobile app |
| `auto_complete_schedule_items()` | Auto-completes overdue schedule items | Mobile + admin schedule |
| `increment_eco_points()` | Updates eco-points balance and recalculates tier | Eco-points engine |
| `get_guest_eco_points()` | Gets guest's current eco-points balance | Mobile + admin |
| `get_eco_leaderboard()` | Returns top eco-points guests | Admin sustainability dashboard |
