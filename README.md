# La Pirogue Hotel Operations

A clean Next.js hotel operations app using the App Router, TypeScript, Tailwind CSS, backend API routes, and Supabase PostgreSQL.

## Architecture

```text
Frontend (Next.js)
      ↓
Backend APIs
      ↓
Supabase Database
```

Backend API routes should be used for privileged operations. Do not expose secret keys in client code; rely on Supabase Auth and RLS policies for authorization. Put sensitive server-only secrets in your hosting provider (e.g., Vercel) environment variables.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file at the project root and add your production values.

3. Add your Supabase URL, public anon key, JWT secret, and app URL in `.env` (do not put secret service keys in client-side `.env` files).

4. In Supabase Auth settings, configure the email templates for invite and recovery flows. The invite template can show the generated password from `{{ .Data.temp_password }}`.

5. Run the SQL in `supabase/schema.sql` inside the Supabase SQL editor. It creates tables, enums, indexes, triggers, storage buckets, RLS, and starter data.

6. Start the app:

```bash
npm run dev
```

## Project Structure

```text
src/
 ├── app/          # App Router pages and API routes
 ├── components/   # Reusable UI components
 ├── hooks/        # Small frontend API hooks
 ├── lib/          # Server helpers
 ├── middleware.ts # Next.js middleware entry point
 ├── services/     # Auth utilities
 └── types/        # Shared TypeScript types
```

Next.js requires middleware to live at `src/middleware.ts`, not inside `src/app`.

Auth emails are sent by Supabase Auth, not SendGrid. Password recovery now uses the Supabase recovery flow, and the local `users` table is synced after the password is updated so the existing login screen keeps working.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run type-check
```

## Notes

- UI screens are preserved from the original design.
- Supabase is accessed only through backend API routes.
- SQL setup lives in `supabase/schema.sql`.
- Source/config files avoid `.js` and `.jsx`; app code uses `.ts` and `.tsx`.

# lapirogue_website
