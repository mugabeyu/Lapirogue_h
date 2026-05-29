# Codebase Cleanup & Refactoring - May 28, 2026

## Summary

Complete refactoring and cleanup of the La Pirogue Hotel Management System codebase, removing duplicate code, unused files, and consolidating environment variables while maintaining all existing functionality.

## Architecture Changes

### Guest Portal Removal
- **Removed**: Guest authentication and portal functionality
- **Guests now**: Only receive informational emails via Resend (no portal access)
- **Staff authentication**: Remains via Supabase Auth with private `/register` endpoint

### Email System Migration
- **Migration**: All emails now sent via Resend API (not Supabase)
- **Guest emails**: Welcome emails with room number, last name, and stay dates
- **Staff emails**: Invitation emails with registration links

## Files Removed

### Unused Files
| File | Reason |
|------|--------|
| `src/lib/guest-portal.ts` | Replaced with minimal `guest-profile.ts` |
| `src/app/api/send-guest-email/route.ts` | Unused endpoint |
| `src/lib/api-auth.ts` | Logic inlined into endpoints |
| `src/lib/turnstile.ts` | Unused captcha verification |
| `src/services/auth.ts` | Unused bcrypt utilities |
| `src/app/guest-portal/` | Guest portal UI (deleted entirely) |
| `src/app/api/guest-portal/` | Guest portal API endpoints (deleted entirely) |

## Files Modified

### Environment Variables (`.env.local`)
**Before**: 8 variables with duplicates
**After**: 5 clean variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
JWT_SECRET=...
```

**Removed duplicates**:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - was fallback
- `SUPABASE_URL` - was fallback
- `SUPABASE_PUBLISHABLE_KEY` - was fallback
- `NEXT_PUBLIC_APP_URL` - unused

### Email Functions (`src/lib/mailer.ts`)
- `sendGuestRoomEmail()` now includes `checkIn` and `checkOut` parameters
- Welcome email includes: room number, last name, check-in/check-out dates
- All emails use Resend API with `FROM_EMAIL` constant

### Guest Profile (`src/lib/guest-profile.ts`)
- New minimal file replacing `guest-portal.ts`
- Provides `loadGuestProfile()` for staff-viewing guest data
- Guest stays data for email sending

### API Endpoints

#### `src/app/api/guests/[id]/profile/route.ts`
- Now uses `loadGuestProfile()` from `guest-profile.ts`

#### `src/app/api/guests/[id]/resend-portal/route.ts`
- Renamed concept: "resend-portal" → guest room information email
- Uses `loadGuestProfile()` for guest data
- Sends email via Resend with stay dates

#### `src/app/api/reservations/route.ts`
- Sends guest email on POST (new reservation)
- Sends guest email on PUT (room assignment/check-in)
- Includes check-in/check-out dates in email

#### `src/app/api/staff/route.ts`
- Uses `sendStaffInvitationEmail()` via Resend
- JWT token for registration link (48h expiry)

#### `src/app/api/staff/reinvite/route.ts`
- Uses `sendStaffInvitationEmail()` via Resend

#### `src/app/api/staff/onboarding/route.ts`
- New endpoint for staff registration
- GET: Validate invitation token
- POST: Create account with password

### Supabase Configuration (Consolidated)

#### `src/lib/supabase.ts`
- Uses `NEXT_PUBLIC_SUPABASE_URL` only (no fallback)

#### `src/lib/supabase-config.ts`
- Simplified to single key names
- Error messages updated to reflect new variable names

#### `src/lib/supabase-browser.ts`
- Uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only

#### `src/proxy.ts`
- Uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only
- No guest-portal routes

### Other API Cleanup

#### `src/app/api/messages/route.ts`
- Inlined `requireAuth()` helper (removed `api-auth.ts` dependency)

#### `src/app/api/content/about/route.ts`
- Simplified authentication

## New Features

### Staff Registration Flow
1. Admin creates staff via `/api/staff` (POST)
2. System creates invitation token (JWT, 48h expiry)
3. Email sent via Resend with registration link
4. Staff visits `/register?token=...` 
5. Staff sets password via `/api/staff/onboarding` (POST)

### Guest Email Flow
1. Guest assigned room via `/api/reservations` (POST/PUT)
2. System sends welcome email via Resend
3. Email contains: last name, room number, check-in/check-out dates

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public anon key for client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server admin key |
| `RESEND_API_KEY` | Resend email service API key |
| `JWT_SECRET` | JWT signing secret (for staff invitations) |

## Build Status
✓ TypeScript compiles successfully
✓ All routes generated
✓ No linting errors