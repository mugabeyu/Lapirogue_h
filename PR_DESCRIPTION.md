Summary of cleanup performed

What I changed

- Fixed a runtime issue where server components passed functions to client components by replacing function props with serializable values (e.g. `rowHrefBuilder` → `rowHrefBase`).
- Extracted shared helpers into `src/lib/`:
  - `table.ts` — table value/format helpers
  - `api-auth.ts` — `requireAuth()` helper
  - `api-response.ts` — `validationErrorResponse()` helper
  - `date-utils.ts` — date/calendar helpers
  - `guests.ts` — guest transformer and types
- Cleaned lint warnings across many files (removed unused vars, fixed hook dependency patterns, memoized values, removed redundant eslint-disable comments).
- Tightened several types and removed trivial `any`/suppression sites where safe.

Validation performed

- `npm run lint` — no warnings or errors after fixes
- `npm run type-check` — passed
- `npm run build` — production build succeeded (Next.js 16.2.6 Turbopack)

Notes / next steps

- Remaining non-critical refactors (e.g., consolidating table components) are available if you'd like continued polishing.
- I created a local branch `chore/cleanup-lint-build` containing all changes. I didn't push or open a PR to avoid impacting remotes — let me know if you want me to push and open a PR.

Files of interest (high-level)

- New: `src/lib/{table,api-auth,api-response,date-utils,guests}.ts`
- Modified: `src/components/CrudDataTablePage.tsx`, `src/components/DataTablePage.tsx`, `src/app/(dashboard)/payments/page.tsx`, `src/app/api/**` (guests, messages, schedule, activities, payments, etc.)

If you'd like, I can now:
- Push the branch and open a PR with this description.
- Continue with medium-risk UI consolidations (DataTable merge).
- Run automated formatting (Prettier) and create a follow-up PR for UI consolidation.

Regards,
Cleanup bot
