# Complete Database Schema Diagram
## La Pirogue HMS - Supabase Database

**Database**: https://txalwdljaxltchcrauhp.supabase.co  
**Total Tables**: 20+  
**Total Indexes**: 30+  
**Date**: 2026-07-14

---

## ER Diagram (High Level)

```
                    ┌─────────────────┐
                    │  auth.users     │
                    │  (Supabase)     │
                    │  ─────────────  │
                    │  • id (PK)      │
                    │  • email        │
                    │  • password     │
                    │  • created_at   │
                    └────────┬────────┘
                    ╱        │       ╲
        ┌──────────────┐     │     ┌─────────────┐
        │   profiles   │────┐├──┐──│   guests    │
        │  (staff)     │    │├──┤──│  (customers)│
        └──────────────┘    │└──┘  └─────────────┘
                            │         │  │  │  │
                ┌───────────┤         │  │  │  │
                │      ┌────┼─────────┘  │  │  │
        ┌───────────┐  │    │    ┌───────┘  │  │
        │ managers  │  │    │    │    ┌─────┘  │
        │           │  │    │    │    │    ┌───┘
        │ auth_id ──┼──┤    │    │    │    │
        │ manager_id│  │    │    │    │    │
        └───────────┘  │    │    │    │    │
                       │    │    │    │    │
        ┌──────────────┐   │    │    │    │
        │receptionists │   │    │    │    │
        │              │   │    │    │    │
        │ auth_id ─────┼───┘    │    │    │
        │ manager_id ──┼────────┘    │    │
        └──────────────┘             │    │
                                     │    │
                       ┌─────────────┘    │
                       │                  │
        ┌──────────────────────┐   ┌──────────────────┐
        │  reservations        │   │   payments       │
        │  ──────────────────  │   │  ──────────────  │
        │  • id                │   │  • id            │
        │  • guest_id ─────┐   │   │  • guest_id ─┐   │
        │  • room_id       │   │   │  • reserv_id ├─┐ │
        │  • check_in_date │   │   │  • amount     │ │ │
        │  • check_out_date│   │   │  • status     │ │ │
        │  • status        │   │   │  • paid_date  │ │ │
        │  • total_price   │   │   └──────────────┘ │ │
        │  • origin        │   │                    │ │
        └──────────────────┘   └────────────────────┘ │
                │                                      │
        ┌───────┴──────────┐                           │
        │                  │                           │
    ┌─────────────┐   ┌─────────────────────┐         │
    │food_orders  │   │activity_bookings    │         │
    │ ─────────── │   │ ─────────────────── │         │
    │ • id        │   │ • id                │         │
    │ • guest_id ─┼─┐ │ • guest_id ──────┐ │         │
    │ • reserv_id │ │ │ • activity_id    │ │         │
    │ • items     │ │ │ • booking_date   │ │         │
    │ • total     │ │ │ • participants   │ │         │
    │ • status    │ │ │ • total_price    │ │         │
    └─────────────┘ │ │ • status         │ │         │
                    │ └────────┬─────────┘ │         │
                    │          │           │         │
                    │    ┌─────────────┐   │         │
                    │    │  activities │   │         │
                    │    │  ────────── │   │         │
                    └────│  • id       │   │         │
                         │  • name     │   │         │
                         │  • price    │   │         │
                         │  • duration │   └─────────┘
                         │  • max_ppl  │
                         └─────────────┘

Additional Related Tables:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   messages   │  │notifications │  │feedback      │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ • guest_id   │  │ • guest_id   │  │ • guest_id   │
│ • sender_id  │  │ • title      │  │ • rating     │
│ • message    │  │ • body       │  │ • comment    │
│ • read_at    │  │ • created_at │  │ • created_at │
└──────────────┘  └──────────────┘  └──────────────┘

Staff Infrastructure:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│departments   │  │ roles        │  │guest_eco_pt  │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ • id         │  │ • id         │  │ • id         │
│ • name       │  │ • name       │  │ • guest_id   │
│ • description│  │ • permissions│  │ • points     │
│ • is_active  │  │ • created_at │  │ • earned_at  │
└──────────────┘  └──────────────┘  └──────────────┘

Shared Infrastructure:
┌──────────────┐  ┌──────────────┐
│rooms         │  │ site_content │
├──────────────┤  ├──────────────┤
│ • id         │  │ • id         │
│ • number     │  │ • page_name  │
│ • type       │  │ • content    │
│ • price      │  │ • published  │
│ • capacity   │  │ • updated_at │
│ • amenities  │  └──────────────┘
│ • status     │
└──────────────┘
```

---

## Detailed Table Specifications

### 1. Authentication & Profiles

#### `auth.users` (Managed by Supabase)
```
┌─────────────────────────────────────┐
│           auth.users                │
├─────────────────────────────────────┤
│ id: UUID (PK)                       │
│ email: TEXT (unique)                │
│ encrypted_password: TEXT            │
│ email_confirmed_at: TIMESTAMPTZ     │
│ created_at: TIMESTAMPTZ             │
│ updated_at: TIMESTAMPTZ             │
│ last_sign_in_at: TIMESTAMPTZ        │
│ ...other Supabase fields            │
└─────────────────────────────────────┘
```

#### `profiles` (Staff Profile Information)
```
┌─────────────────────────────────────┐
│          profiles                   │
├─────────────────────────────────────┤
│ id: UUID (PK)                       │
│ auth_id: UUID (FK → auth.users)     │
│   ↳ Unique constraint               │
│   ↳ CASCADE delete                  │
│ role: user_role (enum)              │
│   ↳ 'ADMIN', 'MANAGER',             │
│     'RECEPTIONIST', 'GUEST'         │
│ first_name: TEXT                    │
│ last_name: TEXT                     │
│ email: TEXT                         │
│ created_at: TIMESTAMPTZ (default)   │
│ updated_at: TIMESTAMPTZ (default)   │
└─────────────────────────────────────┘
   ↓
   └── RLS: Staff members can view their own profile
       ADMIN can view all profiles
```

---

### 2. Guest Management

#### `guests` (Primary Guest/Customer Entity)
```
┌──────────────────────────────────────────────┐
│              guests                          │
├──────────────────────────────────────────────┤
│ id: UUID (PK)                                │
│ auth_id: UUID (FK → auth.users, optional)    │
│   ↳ Unique constraint                        │
│   ↳ NO DELETE on auth user delete           │
│   ↳ Links guest to Supabase Auth             │
│ email: TEXT (unique)                         │
│ first_name: TEXT                             │
│ last_name: TEXT                              │
│ phone: TEXT (optional)                       │
│ home_address: TEXT (optional)                │
│ account_status: guest_account_status (enum)  │
│   ↳ 'PENDING', 'ACTIVE', 'FROZEN', 'BANNED' │
│ guest_status: TEXT                           │
│   ↳ 'active', 'inactive', 'banned'          │
│ eco_points: INTEGER (default: 0)             │
│ created_at: TIMESTAMPTZ (default)            │
│ updated_at: TIMESTAMPTZ (trigger)            │
└──────────────────────────────────────────────┘
   ↓
   ├── CASCADE → reservations
   ├── CASCADE → payments
   ├── CASCADE → food_orders
   ├── CASCADE → activity_bookings
   ├── CASCADE → messages
   ├── CASCADE → notifications
   └── Indexes: auth_id, email, account_status
```

**RLS Policy**:
```sql
-- Guest can only view/edit own record
USING (
  guest_id IN (
    SELECT id FROM guests
    WHERE auth_id = auth.uid()
       OR (auth_id IS NULL AND email = auth.email())
  )
)

-- Staff can view all guests (limited by role)
USING (
  EXISTS (SELECT 1 FROM profiles
    WHERE auth_id = auth.uid()
      AND role::text IN ('ADMIN', 'MANAGER'))
)
```

---

### 3. Room Management

#### `rooms` (Hotel Room Inventory)
```
┌──────────────────────────────────────┐
│           rooms                      │
├──────────────────────────────────────┤
│ id: UUID (PK)                        │
│ room_number: TEXT (unique)           │
│   ↳ E.g., "101", "102", "Suite-A"   │
│ room_type: TEXT                      │
│   ↳ 'Standard', 'Deluxe', 'Suite'   │
│ price_per_night: NUMERIC             │
│   ↳ Currency in DB (USD, EUR, etc)  │
│ status: TEXT (default: 'AVAILABLE')  │
│   ↳ 'AVAILABLE', 'OCCUPIED',         │
│     'CLEANING', 'MAINTENANCE'        │
│ capacity: INTEGER                    │
│   ↳ Max number of guests             │
│ amenities: JSONB                     │
│   ↳ Array of amenity strings         │
│   ↳ E.g., ['WiFi', 'AC', 'TV']      │
│ description: TEXT                    │
│ image_path: TEXT (optional)          │
│   ↳ Path to room image in storage    │
│ created_at: TIMESTAMPTZ (default)    │
│ updated_at: TIMESTAMPTZ (trigger)    │
└──────────────────────────────────────┘
   ↓
   └── Referenced by: reservations (no cascade)
   ├── Index: room_number (unique)
   └── Index: status (for availability queries)
```

**RLS Policy**: Public read access (no auth required)

---

### 4. Reservations & Bookings

#### `reservations` (Guest Room Bookings)
```
┌────────────────────────────────────────────┐
│        reservations                        │
├────────────────────────────────────────────┤
│ id: UUID (PK)                              │
│ guest_id: UUID (FK → guests.id)            │
│   ↳ CASCADE delete → payments, food_orders │
│ room_id: UUID (FK → rooms.id)              │
│ check_in_date: DATE                        │
│ check_out_date: DATE                       │
│ status: reservation_status (enum)          │
│   ↳ 'PENDING', 'CONFIRMED',                │
│     'CHECKED_IN', 'CHECKED_OUT',           │
│     'CANCELLED', 'NO_SHOW', 'RESERVED'     │
│ total_price: NUMERIC                       │
│ number_of_guests: INTEGER                  │
│ special_requests: TEXT (optional)          │
│ origin: order_origin (enum)                │
│   ↳ 'MOBILE_APP', 'RECEPTION_DESK',       │
│     'MANAGER_PORTAL'                       │
│ created_at: TIMESTAMPTZ (default)          │
│ updated_at: TIMESTAMPTZ (trigger)          │
└────────────────────────────────────────────┘
   ↓
   ├── CASCADE → payments
   ├── CASCADE → food_orders (after fix)
   ├── CASCADE → activity_bookings (after fix)
   └── Triggers:
       ├── Update room status on status change
       └── Enforce check-in for food orders
   ├── Indexes: guest_id, room_id, status,
   │           check_in_date, check_out_date
```

**RLS Policy**:
```sql
-- Guests see only own reservations
USING (guest_id IN (SELECT id FROM guests WHERE auth_id = auth.uid()))

-- Staff can view all reservations
USING (EXISTS (SELECT 1 FROM profiles
  WHERE auth_id = auth.uid()
    AND role::text IN ('ADMIN', 'MANAGER', 'RECEPTIONIST')))
```

---

### 5. Payments

#### `payments` (Reservation Payment Records)
```
┌────────────────────────────────────────┐
│         payments                       │
├────────────────────────────────────────┤
│ id: UUID (PK)                          │
│ guest_id: UUID (FK → guests.id)        │
│   ↳ CASCADE delete                     │
│ reservation_id: UUID (FK)              │
│   ↳ CASCADE delete (if reservation del)│
│   ↳ Optional (payment may be separate) │
│ amount: NUMERIC                        │
│   ↳ Exact amount paid                  │
│ status: TEXT                           │
│   ↳ 'PENDING', 'COMPLETED',           │
│     'FAILED', 'PAID', 'REFUNDED'      │
│ payment_method: TEXT                   │
│   ↳ 'cash', 'card', 'bank_transfer'  │
│ payment_date: TIMESTAMPTZ              │
│ created_at: TIMESTAMPTZ (default)      │
│ updated_at: TIMESTAMPTZ (trigger)      │
└────────────────────────────────────────┘
   ↓
   ├── Trigger: Auto-unfreeze guest on completion
   ├── Indexes: guest_id, reservation_id, status
```

**RLS Policy**:
```sql
-- Guests see own payments
USING (guest_id IN (SELECT id FROM guests WHERE auth_id = auth.uid()))

-- Staff can view all payments
USING (EXISTS (SELECT 1 FROM profiles
  WHERE auth_id = auth.uid()
    AND role::text IN ('ADMIN', 'MANAGER', 'RECEPTIONIST')))
```

---

### 6. Food Orders

#### `food_orders` (Restaurant/Bar Orders)
```
┌────────────────────────────────────┐
│       food_orders                  │
├────────────────────────────────────┤
│ id: UUID (PK)                      │
│ guest_id: UUID (FK → guests.id)    │
│   ↳ CASCADE delete                 │
│ reservation_id: UUID (FK)          │
│   ↳ CASCADE delete (after fix)     │
│   ↳ Optional (guest can order      │
│     without active reservation)    │
│ items: JSONB                       │
│   ↳ Array of ordered items         │
│   ├── {name, quantity, price}      │
│ total_price: NUMERIC               │
│ status: TEXT                       │
│   ├─ 'PENDING', 'CONFIRMED',       │
│   ├─ 'DELIVERED', 'CANCELLED'      │
│ origin: order_origin (enum)        │
│   ├─ 'MOBILE_APP', 'RECEPTION'     │
│   └─ 'MANAGER_PORTAL'              │
│ created_at: TIMESTAMPTZ (default)  │
│ updated_at: TIMESTAMPTZ (trigger)  │
└────────────────────────────────────┘
   ↓
   ├── Trigger: Enforce CHECKED_IN status
   └── Index: guest_id, origin
```

**Trigger Enforcement**:
```sql
BEFORE INSERT: Guest must have active CHECKED_IN reservation
  → EXCEPTION if not checked in
  → Prevents ordering before arrival
```

---

### 7. Activity Bookings

#### `activity_bookings` (Excursions & Activities)
```
┌──────────────────────────────────────┐
│     activity_bookings                │
├──────────────────────────────────────┤
│ id: UUID (PK)                        │
│ guest_id: UUID (FK → guests.id)      │
│   ↳ CASCADE delete                   │
│ activity_id: UUID (FK → activities)  │
│ booking_date: DATE                   │
│ status: TEXT                         │
│   ├─ 'PENDING', 'CONFIRMED',         │
│   └─ 'COMPLETED', 'CANCELLED'        │
│ number_of_participants: INTEGER      │
│ total_price: NUMERIC                 │
│ origin: order_origin (enum)          │
│   ├─ 'MOBILE_APP', 'RECEPTION'       │
│   └─ 'MANAGER_PORTAL'                │
│ created_at: TIMESTAMPTZ (default)    │
│ updated_at: TIMESTAMPTZ (trigger)    │
└──────────────────────────────────────┘
   ↓
   ├── Trigger: Enforce CHECKED_IN status
   └── Index: guest_id, activity_id
```

---

### 8. Activities

#### `activities` (Available Activities Master Data)
```
┌─────────────────────────────────────┐
│        activities                   │
├─────────────────────────────────────┤
│ id: UUID (PK)                       │
│ name: TEXT                          │
│   ├─ E.g., "Snorkeling", "Hiking"  │
│ description: TEXT                   │
│ price: NUMERIC (per person)         │
│ duration: TEXT                      │
│   ├─ E.g., "2 hours", "Half day"   │
│ max_participants: INTEGER           │
│ status: BOOLEAN / TEXT              │
│   ├─ true/false or 'active'        │
│ image_path: TEXT (optional)         │
│ created_at: TIMESTAMPTZ (default)   │
│ updated_at: TIMESTAMPTZ (trigger)   │
└─────────────────────────────────────┘
   ↓
   └── Referenced by: activity_bookings
```

**RLS Policy**: Public read access

---

### 9. Messages & Notifications

#### `messages` (Guest-Staff Chat)
```
┌──────────────────────────────────┐
│        messages                  │
├──────────────────────────────────┤
│ id: UUID (PK)                    │
│ guest_id: UUID (FK → guests.id)  │
│   ↳ CASCADE delete               │
│ sender_type: TEXT                │
│   ├─ 'guest' or 'staff'         │
│ sender_id: UUID (optional)       │
│   ├─ auth_id of sender           │
│ message_text: TEXT               │
│ is_read: BOOLEAN (default false) │
│ created_at: TIMESTAMPTZ (default)│
│ updated_at: TIMESTAMPTZ (trigger)│
└──────────────────────────────────┘
   ↓
   └── Index: guest_id, is_read
```

#### `notifications` (Push/In-App Notifications)
```
┌──────────────────────────────────┐
│    notifications                 │
├──────────────────────────────────┤
│ id: UUID (PK)                    │
│ guest_id: UUID (FK → guests.id)  │
│   ↳ CASCADE delete               │
│ title: TEXT                      │
│ body: TEXT                       │
│ notification_type: TEXT          │
│   ├─ 'booking', 'payment',       │
│   ├─ 'message', 'activity'       │
│ data: JSONB (optional)           │
│   ├─ Additional context data     │
│ is_read: BOOLEAN (default false) │
│ created_at: TIMESTAMPTZ (default)│
│ read_at: TIMESTAMPTZ (optional)  │
└──────────────────────────────────┘
   ↓
   └── Index: guest_id, is_read
```

---

### 10. Staff Management

#### `departments` (Hotel Departments)
```
┌─────────────────────────────────────┐
│       departments                   │
├─────────────────────────────────────┤
│ id: UUID (PK)                       │
│ name: TEXT (unique)                 │
│   ├─ E.g., "Front Desk", "Kitchen" │
│ description: TEXT (optional)        │
│ is_active: BOOLEAN (default true)   │
│ created_at: TIMESTAMPTZ (default)   │
│ updated_at: TIMESTAMPTZ (trigger)   │
│ created_by: UUID (FK → auth.users)  │
└─────────────────────────────────────┘
   ↓
   ├── Referenced by: managers, receptionists
   └── RLS: Admin/Manager full, Staff read-only
```

#### `managers` (Manager Staff Records)
```
┌────────────────────────────────────────┐
│         managers                       │
├────────────────────────────────────────┤
│ id: UUID (PK)                          │
│ manager_id: TEXT (unique)              │
│   ├─ Auto-generated: MGR-YYYY-XXXX    │
│ auth_id: UUID (FK → auth.users)        │
│   ├─ Unique                            │
│   └─ CASCADE delete                    │
│ first_name: TEXT (NOT NULL)            │
│ last_name: TEXT (NOT NULL)             │
│ email: TEXT (unique, NOT NULL)         │
│ phone: TEXT (optional)                 │
│ department_id: UUID (FK)               │
│ date_of_joining: DATE (default today)  │
│ is_active: BOOLEAN (default true)      │
│ image_path: TEXT (optional)            │
│ created_at: TIMESTAMPTZ (default)      │
│ updated_at: TIMESTAMPTZ (trigger)      │
│ created_by: UUID (FK → auth.users)     │
└────────────────────────────────────────┘
   ↓
   ├── Referenced by: receptionists (manager_id)
   └── RLS: Admin full, Manager self-view
```

#### `receptionists` (Receptionist Staff Records)
```
┌────────────────────────────────────────┐
│      receptionists                     │
├────────────────────────────────────────┤
│ id: UUID (PK)                          │
│ employee_code: TEXT (unique)           │
│   ├─ Auto-generated: REC-YYYY-XXXX    │
│ auth_id: UUID (FK → auth.users)        │
│   ├─ Unique                            │
│   └─ CASCADE delete                    │
│ first_name: TEXT (NOT NULL)            │
│ last_name: TEXT (NOT NULL)             │
│ email: TEXT (unique, NOT NULL)         │
│ phone: TEXT (optional)                 │
│ department_id: UUID (FK)               │
│ manager_id: UUID (FK → managers.id)    │
│ date_of_joining: DATE (default today)  │
│ is_active: BOOLEAN (default true)      │
│ image_path: TEXT (optional)            │
│ created_at: TIMESTAMPTZ (default)      │
│ updated_at: TIMESTAMPTZ (trigger)      │
│ created_by: UUID (FK → auth.users)     │
└────────────────────────────────────────┘
   ↓
   └── RLS: Manager full, Receptionist self-view
```

---

### 11. Sustainability & Feedback

#### `guest_eco_point_events` (Eco Points Tracking)
```
┌───────────────────────────────────┐
│ guest_eco_point_events            │
├───────────────────────────────────┤
│ id: UUID (PK)                     │
│ guest_id: UUID (FK → guests.id)   │
│ activity_id: UUID (FK)            │
│ source_type: TEXT                 │
│   ├─ 'MANUAL', 'BOOKING', etc     │
│ source_record_id: TEXT            │
│ source_label: TEXT                │
│ points: INTEGER                   │
│ carbon_offset_kg: NUMERIC         │
│ metadata: JSONB                   │
│ status: TEXT (default 'COMPLETED')│
│ earned_at: TIMESTAMPTZ (default)  │
│ created_at: TIMESTAMPTZ (default) │
└───────────────────────────────────┘
   ↓
   └── RLS: Staff manage, Guests view own
```

#### `guest_feedback` (Reviews & Ratings)
```
┌──────────────────────────────────┐
│     guest_feedback               │
├──────────────────────────────────┤
│ id: UUID (PK)                    │
│ guest_id: UUID (FK → guests.id)  │
│ rating: INTEGER (1-5)            │
│ comment: TEXT                    │
│ feedback_type: TEXT              │
│   ├─ 'general', 'room', 'food'  │
│ is_public: BOOLEAN               │
│ created_at: TIMESTAMPTZ (default)│
│ updated_at: TIMESTAMPTZ (trigger)│
└──────────────────────────────────┘
   ↓
   └── RLS: Guests manage own
```

---

### 12. Other Tables

#### `roles` (Role Definitions)
```
┌────────────────────────────────┐
│         roles                  │
├────────────────────────────────┤
│ id: UUID (PK)                  │
│ name: TEXT (unique)            │
│   ├─ 'ADMIN', 'MANAGER', etc   │
│ description: TEXT              │
│ permissions: JSONB             │
│   ├─ {"manage_users": true}    │
│ created_at: TIMESTAMPTZ        │
│ updated_at: TIMESTAMPTZ        │
└────────────────────────────────┘
```

#### `site_content_pages` (CMS Pages)
```
┌──────────────────────────────────┐
│   site_content_pages             │
├──────────────────────────────────┤
│ id: UUID (PK)                    │
│ page_name: TEXT (unique)         │
│   ├─ 'about', 'services', etc    │
│ content: TEXT (markdown/html)    │
│ meta_description: TEXT           │
│ is_published: BOOLEAN            │
│ created_at: TIMESTAMPTZ (default)│
│ updated_at: TIMESTAMPTZ (trigger)│
└──────────────────────────────────┘
```

---

## Complete Relationship Matrix

| Table | Relationship | Type | Cascade | RLS |
|-------|--------------|------|---------|-----|
| guests → auth.users | auth_id | FK | NO | ✅ |
| guests → reservations | id:guest_id | 1:N | YES | ✅ |
| guests → payments | id:guest_id | 1:N | YES | ✅ |
| guests → food_orders | id:guest_id | 1:N | YES | ✅ |
| guests → activity_bookings | id:guest_id | 1:N | YES | ✅ |
| guests → messages | id:guest_id | 1:N | YES | ✅ |
| guests → notifications | id:guest_id | 1:N | YES | ✅ |
| rooms → reservations | id:room_id | 1:N | NO | - |
| reservations → payments | id:reserv_id | 1:N | YES | ✅ |
| reservations → food_orders | id:reserv_id | 1:N | YES | ✅ |
| reservations → activity_bookings | id:reserv_id | 1:N | YES | ✅ |
| activities → activity_bookings | id:activity_id | 1:N | NO | ✅ |
| departments → managers | id:dept_id | 1:N | NO | ✅ |
| departments → receptionists | id:dept_id | 1:N | NO | ✅ |
| managers → receptionists | id:mgr_id | 1:N | NO | ✅ |
| profiles → auth.users | auth_id | FK | CASCADE | ✅ |
| managers → auth.users | auth_id | FK | CASCADE | ✅ |
| receptionists → auth.users | auth_id | FK | CASCADE | ✅ |

---

## Indexes for Performance

```sql
-- Guests
CREATE INDEX idx_guests_auth_id ON guests(auth_id);
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_account_status ON guests(account_status);

-- Reservations
CREATE INDEX idx_reservations_guest_id ON reservations(guest_id);
CREATE INDEX idx_reservations_room_id ON reservations(room_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_check_in_date ON reservations(check_in_date);
CREATE INDEX idx_reservations_check_out_date ON reservations(check_out_date);

-- Payments
CREATE INDEX idx_payments_guest_id ON payments(guest_id);
CREATE INDEX idx_payments_reservation_id ON payments(reservation_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Food Orders
CREATE INDEX idx_food_orders_guest_id ON food_orders(guest_id);
CREATE INDEX idx_food_orders_reservation_id ON food_orders(reservation_id);
CREATE INDEX idx_food_orders_origin ON food_orders(origin);

-- Activity Bookings
CREATE INDEX idx_activity_bookings_guest_id ON activity_bookings(guest_id);
CREATE INDEX idx_activity_bookings_activity_id ON activity_bookings(activity_id);
CREATE INDEX idx_activity_bookings_origin ON activity_bookings(origin);

-- Staff
CREATE INDEX idx_managers_auth_id ON managers(auth_id);
CREATE INDEX idx_managers_department_id ON managers(department_id);
CREATE INDEX idx_receptionists_auth_id ON receptionists(auth_id);
CREATE INDEX idx_receptionists_manager_id ON receptionists(manager_id);

-- Messages
CREATE INDEX idx_messages_guest_id ON messages(guest_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);

-- Notifications
CREATE INDEX idx_notifications_guest_id ON notifications(guest_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Eco Points
CREATE INDEX idx_guest_eco_point_events_guest_id ON guest_eco_point_events(guest_id);
CREATE INDEX idx_guest_eco_point_events_earned_at ON guest_eco_point_events(earned_at);
```

---

## Data Size Estimates

```
Estimated Table Sizes (at 1000+ guests):
┌────────────────────────┬──────────┐
│ Table                  │ Est. Rows│
├────────────────────────┼──────────┤
│ guests                 │   1,000+ │
│ reservations           │   5,000+ │
│ payments               │   5,000+ │
│ food_orders            │   3,000+ │
│ activity_bookings      │   1,000+ │
│ messages               │  10,000+ │
│ notifications          │  15,000+ │
│ guest_feedback         │   2,000+ │
│ guest_eco_point_events │   5,000+ │
├────────────────────────┼──────────┤
│ Total Data             │  47,000+ │
│ Storage Size           │  2-3 GB  │
└────────────────────────┴──────────┘
```

---

## Schema Maintenance

### Backup Strategy
- Daily automated backups
- 7-day retention
- Point-in-time recovery enabled

### Monitoring Points
- Table sizes and growth rate
- Index health (slow queries)
- RLS policy performance
- Foreign key constraint violations

### Future Scalability
- Partition large tables (guests, reservations) by date
- Archive completed reservations (>1 year old)
- Implement read replicas for reporting

---

Generated: 2026-07-14  
Database: https://txalwdljaxltchcrauhp.supabase.co
