# La Pirogue Hotel Management System — Documentation Report

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Database Schema](#database-schema)
5. [Features & Modules](#features--modules)
6. [Authentication & Authorization](#authentication--authorization)
7. [API Reference](#api-reference)
8. [Frontend Components](#frontend-components)
9. [Styling System](#styling-system)
10. [Utilities & Helpers](#utilities--helpers)
11. [Environment Configuration](#environment-configuration)
12. [Build & Deployment](#build--deployment)

---

## 1. Project Overview

**Name:** La Pirogue Hotel Management System (HMS)  
**Version:** 1.0.0  
**Purpose:** Enterprise-grade hotel/resort management platform for La Pirogue — a full-service resort. Provides end-to-end operations management including guest booking, room inventory, reservations, food & beverage orders, activity tours, payments/invoicing, staff onboarding, messaging, sustainability/eco programs, and analytics reporting.  
**Type:** Single-repo full-stack web application  
**Hosting Target:** Supabase (PostgreSQL) + Next.js deployment  

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.8 |
| Runtime | Node.js (server) + React 18 (client) |
| Database | Supabase (PostgreSQL) |
| ORM / DB Client | `@supabase/supabase-js` (no Prisma/TypeORM) |
| Auth | Supabase Auth |
| Styling | Tailwind CSS 3.4 + Custom CSS Variables |
| Forms | React Hook Form + Zod validation |
| UI Primitives | `@headlessui/react`, `lucide-react`, `sonner` (toasts) |
| Animations | `framer-motion` |
| Charts | `recharts` |
| PDF | jsPDF |
| Email | Resend API + Nodemailer |
| Client Fetching | SWR |
| Icons | lucide-react |
| Token / Hash | `jose`, `jsonwebtoken`, `bcrypt`, `bcryptjs` |

---

## 3. Directory Structure

```
website/
├── .env                        # Production environment variables
├── .env.local                  # Local overrides (e.g. NEXT_PUBLIC_APP_URL)
├── .eslintrc.json              # ESLint flat config
├── middleware.ts               # Next.js middleware (auth guard)
├── next.config.ts              # Next.js configuration
├── next-env.d.ts               # TypeScript declarations for Next.js
├── package.json                # Project metadata & scripts
├── postcss.config.mjs           # PostCSS (Tailwind + Autoprefixer)
├── tailwind.config.ts           # Tailwind theme + plugins
├── tsconfig.json                # TypeScript config (paths: @/* -> ./src/*)
├── public/
│   ├── images/                  # Static images (backgrounds, logo)
│   └── lapiroguelogo.jpg        # Brand logo
├── supabase/
│   ├── schema.sql               # Canonical DB schema, triggers, RLS
│   └── migrations/              # Numbered SQL migration files
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── globals.css           # Global styles + CSS variables
│   │   ├── layout.tsx            # Root layout (Inter font, Toaster)
│   │   ├── page.tsx              # Root page (auth redirect)
│   │   ├── (auth)/               # Auth route group
│   │   │   ├── login/page.tsx           # Staff login
│   │   │   ├── register/page.tsx        # Staff self-onboarding
│   │   │   ├── forgot-password/page.tsx # Password reset request
│   │   │   └── reset-password/page.tsx  # Password reset form
│   │   ├── (dashboard)/          # Protected dashboard route group
│   │   │   ├── layout.tsx              # Server-side auth layout
│   │   │   ├── page.tsx                # Dashboard home
│   │   │   ├── guests/page.tsx         # Guest list
│   │   │   ├── guests/[id]/page.tsx    # Guest detail
│   │   │   ├── rooms/page.tsx          # Room management
│   │   │   ├── rooms/assign/page.tsx   # Room assignment
│   │   │   ├── reservations/page.tsx   # Reservations list
│   │   │   ├── reservations/calendar/page.tsx
│   │   │   ├── reservations/new/page.tsx
│   │   │   ├── activities/page.tsx
│   │   │   ├── activities/calendar/page.tsx
│   │   │   ├── activities/new/page.tsx
│   │   │   ├── schedule/page.tsx
│   │   │   ├── food-beverage/page.tsx
│   │   │   ├── food-beverage/orders/page.tsx
│   │   │   ├── food-beverage/orders/new/page.tsx
│   │   │   ├── payments/page.tsx
│   │   │   ├── payments/[id]/page.tsx
│   │   │   ├── invoice/page.tsx
│   │   │   ├── messages/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── feedback/page.tsx
│   │   │   ├── staff/page.tsx
│   │   │   ├── staff/roles/page.tsx
│   │   │   ├── sustainability/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── emergency-contacts/page.tsx
│   │   └── api/                 # ~38 Next.js Route Handlers (REST API)
│   │       ├── auth/                     # Login, logout, password, onboarding
│   │       ├── staff/                    # Reinvite
│   │       ├── settings/                 # Profile & password
│   │       ├── guests/[id]/              # Guest CRUD
│   │       ├── rooms/                    # Room CRUD
│   │       ├── reservations/             # Reservation CRUD + calendar
│   │       ├── activities/               # Activity CRUD + calendar + booking
│   │       ├── schedule/                 # Schedule CRUD + options
│   │       ├── food-orders/              # Food order CRUD
│   │       ├── menu-items/               # Menu catalog CRUD
│   │       ├── payments/[id]/            # Payment detail + invoice sending
│   │       ├── feedback/                 # Guest feedback
│   │       ├── messages/                 # Guest ↔ staff messaging
│   │       ├── notifications/            # In-app notifications
│   │       ├── hotel-services/           # Service catalog
│   │       ├── hotel-service-categories/ # Service categories
│   │       ├── emergency-contacts/       # Emergency info CRUD
│   │       ├── roles/                    # Role configuration
│   │       ├── sustainability/           # Eco program + awards
│   │       └── reports/                  # Analytics endpoints
│   ├── components/               # Shared UI & feature components
│   │   ├── Layout.tsx             # Dashboard shell (Sidebar + Topbar)
│   │   ├── Sidebar.tsx            # Collapsible navigation
│   │   ├── Topbar.tsx             # Header bar (user, date, actions)
│   │   ├── modals/                # 11 modal dialogs (Guest, Reservation, etc.)
│   │   ├── forms/                 # Complex form pages (Calendar, Assign Room, etc.)
│   │   ├── pickers/               # Search picker fields (Guest, Room)
│   │   ├── ui/                    # Reusable primitives (Button, Card, FormSection)
│   │   └── ...                    # Feature pages (Dashboard, Rooms, Guests, etc.)
│   ├── contexts/
│   │   └── SidebarContext.tsx      # Sidebar collapsed state (localStorage)
│   ├── hooks/
│   │   └── useApi.ts               # SWR-based hooks for data fetching / mutations
│   ├── lib/                        # Backend utilities & shared modules
│   │   ├── supabase-browser.ts     # Client-side Supabase init
│   │   ├── supabase-server.ts      # Server-side Supabase init
│   │   ├── supabase-config.ts      # Config validation + placeholder guards
│   │   ├── auth-server.ts          # getServerSession() helper
│   │   ├── router.tsx              # React Router–style navigation abstraction
│   │   ├── api-response.ts         # Standard { success, data, error } shape
│   │   ├── audit.ts                # Audit logging
│   │   ├── billing.ts              # Billing calculations
│   │   ├── date-utils.ts           # Date helpers
│   │   ├── countries.ts            # Country list
│   │   ├── phone.ts                # Phone parsing
│   │   ├── mailer.ts               # Email sending
│   │   ├── resend.ts               # Resend integration
│   │   ├── supabase-email.ts       # Supabase email invite helpers
│   │   ├── invoice-pdf.ts          # PDF invoice generation
│   │   ├── upload-image.ts         # File upload to Supabase Storage
│   │   ├── activities.ts           # Activity domain helpers
│   │   ├── guests.ts               # Guest domain helpers
│   │   └── ...
│   └── types/
│       └── index.ts                # Full TypeScript interfaces (~298 lines)
```

---

## 4. Database Schema

**Database:** Supabase (PostgreSQL)  
**Schema Location:** `supabase/schema.sql` + `supabase/migrations/`  
**RLS:** Enabled on all tables  
**Auditing:** `audit_logs` table tracks insert/update/delete on all core entities  

### Core Tables

| Table | Description |
|-------|-------------|
| `profiles` | Staff accounts mapped to Supabase Auth `users`. Roles: ADMIN, MANAGER, RECEPTION, RESTAURANT, TOUR_MANAGER, STAFF, RECEPTIONIST |
| `guests` | Hotel guest records (`guest_id` sequence) |
| `rooms` | Room inventory (STANDARD / DELUXE / SUITE / VILLA), status, amenities |
| `reservations` | Booking records with `reservation_id`, linked to guests & rooms |
| `payments` | Transaction records (4 methods × 4 statuses) |
| `payment_extra_items` | Ancillary charges (laundry, transport, etc.) |
| `food_orders` | In-room / restaurant orders |
| `guest_orders` | Order-to-guest linkage |
| `menu_items` | Restaurant catalog |
| `activities` | Tours & excursions catalog |
| `activity_bookings` | Guest activity bookings |
| `hotel_services` | Service catalog |
| `hotel_service_categories` | Service categories |
| `itinerary_events` | Daily itinerary entries |
| `guest_schedule_items` | Per-guest schedule |
| `staff` | Employee directory |
| `roles` | RBAC role definitions |
| `notifications` | In-app notifications |
| `guest_feedback` | Reviews & ratings |
| `messages` | Structured guest ↔ staff chat (PostgREST Realtime enabled) |
| `staff_onboarding` | Passwordless staff invitation (invite_token) |
| `sustainability_activities` | Eco program activities |
| `eco_tiers` | Eco point tiers |
| `guest_eco_point_events` | Eco transaction events |
| `eco_points_balance` | Current balances |
| `eco_points_tx` | Point transaction history |
| `site_content_pages` | CMS-like landing page content |
| `emergency_contacts` | Resort emergency info |
| `storage_files` | File upload registry |
| `audit_logs` | Write-only audit trail |

### Key Database Triggers

- `update_room_status_on_reservation` — Auto-sets room status (OCCUPIED / CLEANING / AVAILABLE) based on reservations
- `validate_reservation_status_dates` — Prevents CHECKED_IN / CHECKED_OUT out of allowed date windows
- `validate_guest_status_dates` — Guest CHECKED_IN requires an active reservation for today
- `set_updated_at` — Auto-updates `updated_at` on row change
- `set_created_by_and_updated_by` — Auto-populates `created_by` / `updated_by`
- `log_audit_event` — Writes to `audit_logs` for most tables

---

## 5. Features & Modules

### Authentication & Staff Management
- **Login** — Email + password (Supabase Auth)
- **Forgot / Reset Password** — Email-based reset flow via Resend
- **Staff Onboarding** — Admin-invited token-based self-registration (`/register?token=`)
- **Reinvite** — Resend onboarding invite to staff
- **Role Guarding** — Two-tier role model: `MAIN_RECEPTIONIST` vs `RECEPTIONIST` (plus extended roles in DB)

### Guest Management
- Guest CRUD with VIP flag, status tracking (CHECKED_IN / CHECKED_OUT / RESERVED / INACTIVE)
- Guest profile page showing stays, activity bookings, food orders, payments, stats
- Guest portal resend (email link to guest-facing view)
- Image upload for guest avatar
- Search & filter (room, name, status)

### Room Management
- Room inventory CRUD (STANDARD / DELUXE / SUITE / VILLA)
- Room status auto-updated by triggers (OCCUPIED / CLEANING / AVAILABLE / MAINTENANCE)
- Room assignment UI (`/rooms/assign`)
- Room search pickers (linked guest ↔ room)

### Reservations
- Reservation CRUD with check-in / check-out dates, adults, children, amounts
- Reservation calendar view
- New reservation form
- Status flow: RESERVED → CHECKED_IN → CHECKED_OUT

### Food & Beverage
- Menu catalog CRUD (categories, items, prices)
- In-room & restaurant order creation (`AddFoodOrderPage`)
- Order list with status tracking
- Service charge, tax, subtotal calculations

### Activities & Tours
- Activity catalog CRUD
- Activity calendar view
- Activity booking flow (`BookActivityModal`)
- Booking status & payment status tracking

### Daily Schedule
- Schedule CRUD for daily operations
- Schedule options helper endpoint

### Payments & Invoicing
- Payment CRUD with 4 methods (CASH, CARD, BANK_TRANSFER, MOBILE) and 4 statuses (PENDING, PAID, PARTIALLY_PAID, REFUNDED)
- Extra item charges (laundry, transport, mini bar, etc.)
- PDF invoice generation via jsPDF
- Send invoice via email (Resend / Nodemailer)
- Payment detail page with history

### Guest Messaging
- Real-time chat between staff and guests
- Message status tracking

### Notifications
- In-app notifications
- Mark-as-read / unread state

### Guest Feedback
- Reviews & ratings collection
- Feedback list page

### Sustainability / Eco Program
- Sustainability activity logging
- Eco points balance & transaction history
- Tiers system (gamification)
- Award points flow (`/api/sustainability/award`)

### Staff Management
- Staff directory CRUD
- Role assignment (via `/api/staff/roles`)
- Account reactivation / deactivation

### Reports & Analytics
- Dashboard KPIs (occupancy, revenue, check-ins today, etc.)
- Recharts-based charts
- Revenue, occupancy, guest analytics

### Settings
- Profile update (name, phone, avatar)
- Password change (Re-enter current + new password)

### Emergency Contacts
- Resort emergency info (medical, fire, security, etc.)
- Public-facing page (`/emergency-contacts`)

---

## 6. Authentication & Authorization

### Architecture

| Layer | Mechanism |
|-------|-----------|
| Front-door | `middleware.ts` — Matches `/api/*`, `/login`, `/register`, `/dashboard` |
| Server session | `getServerSession()` in `src/lib/auth-server.ts` — Reads Supabase SSR cookies, fetches `profiles` row, blocks `is_active = false` |
| Client-side | `ProtectedPage.tsx` — Wraps dashboard client components |
| Database | RLS policies + `is_active` flag on `profiles` |

### Middleware Rules (`middleware.ts`)

```typescript
// Public (no auth required)
/api/auth/login
/api/auth/forgot-password
/api/auth/verify
/api/auth/password-sync
/api/staff/onboarding
/register, /login, /forgot-password, /reset-password

// Protected (auth required)
/all other /api/*
/dashboard/*

// Redirects
Authenticated user → /auth route → redirect to /dashboard
Unauthenticated user → /dashboard → redirect to /login
Unauthenticated user → / → redirect to /login
Authenticated user → / → redirect to /dashboard
```

### Role System

| Role | Description | Assignment |
|------|-------------|-----------|
| `MAIN_RECEPTIONIST` | Primary supervisor, system admin | First profile in DB (unique partial index on `is_main`) |
| `RECEPTIONIST` | Standard front-desk / operations staff | Standard signup / onboarding |
| `ADMIN` | Supabase auth back-end access | DB enum only |
| `MANAGER` | Department manager | DB enum only |
| `RESTAURANT` | F&B staff | DB enum only |
| `TOUR_MANAGER` | Activity / tour supervisor | DB enum only |
| `STAFF` | General employee | DB enum only |

**Note:** Application-level type in `src/types/index.ts` simplifies DB roles to `'MAIN_RECEPTIONIST' | 'RECEPTIONIST'` driven by `is_main` boolean flag on `profiles`.

### Password Policy (enforced in `/api/auth/password-sync`)

- Min 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (`!@#$%^&*`)

---

## 7. API Reference

All API routes live under `src/app/api/` and are Next.js Route Handlers. They use `createRouteHandlerSupabaseContext` from `@supabase/ssr` to share auth context with the rest of the app.

### Auth API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Sign in with email + password. Upserts profile row. Sets session cookies. |
| POST | `/api/auth/logout` | Sign out. Clears session cookies. |
| GET | `/api/auth/me` | Returns current user profile from session cookies. |
| POST | `/api/auth/forgot-password` | Sends password reset email via Resend / Nodemailer. |
| GET | `/api/auth/verify` | Verifies recovery token from email link. |
| POST | `/api/auth/password-sync` | Syncs / updates password. Triggers Supabase `updateUser`. |

### Staff Management API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/staff/onboarding` | Validates invite token and provisions Supabase Auth user. |
| POST | `/api/staff/reinvite` | Resends onboarding invite email. |

### Settings API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/profile` | Returns current user profile. |
| PATCH | `/api/settings/profile` | Updates profile (name, phone, avatar, password hash). |
| PATCH | `/api/settings/password` | Changes password (requires current password verification). |

### Reservations API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reservations` | Lists reservations (with room & guest joins). |
| POST | `/api/reservations` | Creates reservation. |
| GET | `/api/reservations/calendar` | Calendar data for date-range picks. |

### Rooms API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | Lists rooms with optional filters. |
| POST | `/api/rooms` | Creates room (RECEPTIONIST only via RLS). |
| PATCH | `/api/rooms` | Updates room. |
| DELETE | `/api/rooms` | Deletes room. |

### Guests API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guests` | Lists guests with search & filters. |
| POST | `/api/guests` | Creates guest. |
| GET | `/api/guests/[id]` | Single guest with stays, orders, bookings, payments. |
| PATCH | `/api/guests/[id]` | Updates guest. |
| DELETE | `/api/guests/[id]` | Deletes guest. |
| GET | `/api/guests/[id]/profile` | Full guest profile (billing summary, stats). |
| POST | `/api/guests/[id]/resend-portal` | Resends guest portal invite email. |

### Food & Beverage API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/menu-items` | Menu catalog CRUD. |
| GET | `/api/food-orders` | Lists food orders. |
| POST | `/api/food-orders` | Creates food order. |

### Payments API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/[id]` | Payment detail + linked items. |
| PATCH | `/api/payments/[id]` | Updates payment. |
| DELETE | `/api/payments/[id]` | Deletes payment. |
| POST | `/api/payments/[id]/send-invoice` | Generates PDF and emails invoice. |

### Activities API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activities` | Lists activities. |
| POST | `/api/activities` | Creates activity. |
| GET | `/api/activities/calendar` | Calendar data. |
| POST | `/api/activities/book` | Books activity for guest. |

### Schedule API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedule` | Lists schedule items. |
| POST | `/api/schedule` | Creates schedule item. |
| GET | `/api/schedule/options` | Helper — returns lookup options. |

### Sustainability API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sustainability` | Eco dashboard data. |
| POST | `/api/sustainability` | Logs eco activity. |
| POST | `/api/sustainability/award` | Awards points to guest. |

### Messaging API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages` | Lists messages (Realtime). |
| POST | `/api/messages` | Creates message. |
| PATCH | `/api/messages` | Marks message read. |

### Feedback API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feedback` | Lists feedback with review data. |
| POST | `/api/feedback` | Submits feedback. |

### Notifications API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PATCH | `/api/notifications` | Lists & marks notifications. |

### Services API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/hotel-services` | Service catalog CRUD. |
| GET/POST | `/api/hotel-service-categories` | Category CRUD. |

### Staff & Roles API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PATCH/DELETE | `/api/roles` | Role management. |
| GET | `/api/dashboard` | Dashboard stats. |
| GET | `/api/reports` | Analytics reports data. |
| GET/POST | `/api/emergency-contacts` | Emergency info CRUD. |

### Standard Response Shape

All endpoints return:

```json
{
  "success": boolean,
  "data": any,
  "error": string | null
}
```

HTTP errors return Supabase error codes or descriptive `{ success: false, error: "..." }` objects.

---

## 8. Frontend Components

### Shell Components (`src/components/`)

| Component | File | Purpose |
|-----------|------|---------|
| `Layout` | `Layout.tsx` | Dashboard shell: composed Sidebar + Topbar + content area |
| `Sidebar` | `Sidebar.tsx` | Collapsible nav with icons; links to all top-level modules |
| `Topbar` | `Topbar.tsx` | Header: current user (from `/api/auth/me`), date, quick actions, notifications bell |
| `PageHeader` | `PageHeader.tsx` | Consistent section title + breadcrumb area |
| `StatCard` | `StatCard.tsx` | KPI tile (icon + label + value + delta) |
| `StatusBadge` | `StatusBadge.tsx` | Colored status pill (OCCUPIED, PAID, etc.) |
| `ConfirmDialog` | `ConfirmDialog.tsx` | Confirmation dialog for destructive actions |
| `Modal` | `Modal.tsx` | Generic modal wrapper |
| `ProtectedPage` | `ProtectedPage.tsx` | Client-side auth guard for dashboard pages |
| `AppToaster` | `AppToaster.tsx` | Sonner toaster wrapper |

### Data Table Wrappers

| Component | Purpose |
|-----------|---------|
| `DashboardDataPage` | Stats grid + today's check-in / check-out lists |
| `DataTablePage` | Generic static data table |
| `CrudDataTablePage` | Generic CRUD table with search, create, edit, delete |
| `GuestsPage` | Guest list with search & filter |
| `GuestDetailsPage` | Single guest detail view |
| `RoomsPage` | Room management table |

### Modals (`src/components/modals/`)

`AddGuestModal`, `EditGuestModal`, `AddReservationModal`, `RoomModal`, `AddFoodOrderModal`, `MenuItemModal`, `AddActivityModal`, `BookActivityModal`, `PaymentModal`, `StaffModal`, `CreateScheduleItemModal`

### Forms (`src/components/forms/`)

`ActivityCalendarPage`, `AddActivityPage`, `AddFoodOrderPage`, `AddReservationPage`, `AssignRoomPage`, `ReservationCalendarPage`, `SchedulePage`

### Picker Fields (`src/components/pickers/`)

`GuestSearchPicker`, `RoomSearchPicker`, `GuestRoomSearchField` — Autocomplete-style search fields for linking guests & rooms.

### UI Primitives (`src/components/ui/`)

`Button`, `Card`, `FormSection`, `LabeledTable`, `PhoneField`, `CountryComboboxField`, `ImageUploadField`

---

## 9. Styling System

### Tailwind + Custom CSS

- **Framework:** Tailwind CSS 3.4
- **Fonts:** `Inter` (loaded via `next/font/google`) as the primary typeface; `Poppins` referenced in Tailwind config
- **No box-shadows** — All surfaces use solid borders
- **Animations:** CSS `fade-in` keyframe (Tailwind `animate-fade-in`); `framer-motion` for sidebar accordion/expanding

### Brand Colors (CSS Variables + Tailwind)

| Variable / Token | Color | Usage |
|-----------------|-------|-------|
| `--color-primary` | `#A1C181` | Primary buttons, active states |
| `--color-primary-hover` | `#8AAE6A` | Hover on primary |
| `--color-accent` | `#FE7F2D` | Accent / CTA / hover |
| `--color-sidebar` | `#619B8A` | Sidebar background |
| `--color-icon` / `--color-highlight` | `#FCCA46` | Icons, highlights |
| `--color-success` | `#4CAF50` | Success badges |
| `--color-danger` | `#F44336` | Danger actions |
| `--color-border` | `#E5E7EB` | Card borders |

### Spacing Scale

```
--spacing-page: 32px   (outer page padding)
--spacing-section: 24px (between sections)
--spacing-card: 16px    (within cards)
--spacing-inline: 8px   (between inline elements)
```

### Radius

```
--radius-sm: 8px
--radius: 12px          (default for cards, buttons, inputs)
--radius-lg: 16px       (modals, large cards)
--radius-full: 9999px   (pills, badges)
```

### Utility CSS Classes (`globals.css`)

- `.btn-primary` — Primary button style
- `.btn-secondary` — Secondary / outlined button
- `.btn-danger` — Destructive button
- `.card` — White card with border
- `.input-field` — Styled form input
- `.badge` — Status pill
- `.badge-pill` — Full pill shape
- `.table-wrap` — Scrollable table container
- `.auth-page-bg` — Full-screen auth background

### Toasts

Uses `sonner` (positioned top-center, rich colors).

---

## 10. Utilities & Helpers

| Module | Purpose |
|--------|---------|
| `src/lib/supabase-browser.ts` | Client-side Supabase singleton |
| `src/lib/supabase-server.ts` | Server-side Supabase singleton |
| `src/lib/supabase-config.ts` | Config validation — checks placeholder values, validates URL format |
| `src/lib/auth-server.ts` | `getServerSession()` — reads Supabase cookies on server |
| `src/lib/router.tsx` | `Link`, `NavLink`, `useNavigate`, `useLocation`, `useParams` over Next.js primitives |
| `src/lib/api-response.ts` | `success`, `data`, `error` payload helper |
| `src/lib/audit.ts` | Audit log entry writer |
| `src/lib/billing.ts` | Billing calculation helpers |
| `src/lib/date-utils.ts` | Date formatting / parsing |
| `src/lib/countries.ts` | Country list constant |
| `src/lib/phone.ts` | Phone number parsing / formatting |
| `src/lib/mailer.ts` | Nodemailer adapter for Resend fallback |
| `src/lib/resend.ts` | Resend email helper |
| `src/lib/invoice-pdf.ts` | jsPDF invoice generator |
| `src/lib/upload-image.ts` | Upload files to Supabase Storage |
| `src/lib/eco-points.ts` | Eco-point business logic |
| `src/lib/guest-profile.ts` | Guest profile aggregation |
| `src/lib/guest-profile.ts` | Guest profile aggregation |

### Client Hooks

| Hook | Purpose |
|------|---------|
| `useApi` (via `useApi.ts`) | GET requests — SWR-based cached fetch |
| `useApiMutation` (via `useApi.ts`) | POST / PATCH / DELETE — mutation wrapper |

---

## 11. Environment Variables

### `.env` (Production)

| Variable | Scope | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Project URL (`https://afilatpihmbicqadwslm.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + Server | Public anon / publishable key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Legacy anon key (also set for compatibility) |
| `SUPABASE_URL` | Server | Server-side copy |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Server-side copy |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Privileged operations (require admin) |
| `RESEND_API_KEY` | Server | Resend API key for transactional email |

### `.env.local` (Development)

All of the above plus `NEXT_PUBLIC_APP_URL` (defaults to `http://localhost:3000`).

**Placeholder Guard:** `src/lib/supabase-config.ts` throws at startup if any Supabase credential is missing, malformed, or still set to a placeholder value (e.g. `your-project.supabase.co`).

---

## 12. Build & Deployment

### Scripts (`package.json`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (Next.js) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript type check (`tsc --noEmit`) |

### Next.js Config

- `reactStrictMode: true`
- `productionBrowserSourceMaps: true`
- Remote image pattern: `https://images.unsplash.com`

### Deployment Notes

- **Supabase** must be running with schema + migrations applied (see `supabase/schema.sql` and `supabase/migrations/`)
- **Environment variables** must be set in `.env` for production
- **Type-check + lint + build** should pass before deployment
- **RLS** is enforced — all production API calls must authenticate
- **Resend** is used for all transactional email (password reset, onboarding invite, invoices)

---

## Quick Reference Summary

| Concern | Location / Tool |
|---------|-----------------|
| Database changes | `supabase/migrations/*.sql` |
| Full schema | `supabase/schema.sql` |
| Route changes | `src/app/api/`, `src/app/*/page.tsx` |
| Auth guarding | `middleware.ts`, `src/lib/auth-server.ts`, `ProtectedPage.tsx` |
| UI theme / styles | `tailwind.config.ts`, `src/app/globals.css` |
| Environment vars | `.env` + `.env.local` |
| Type definitions | `src/types/index.ts` |
| API client helpers | `src/lib/api-response.ts`, `src/hooks/useApi.ts` |
| Email | `src/lib/mailer.ts`, `src/lib/resend.ts`, `src/lib/supabase-email.ts` |
| PDF invoices | `src/lib/invoice-pdf.ts` |
| Image uploads | `src/lib/upload-image.ts` |
| Logging / audit | `src/lib/audit.ts` |
