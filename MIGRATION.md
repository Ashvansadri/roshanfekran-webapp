# Roshanfekran migration — staging only

This is the existing independent Render staging site, connected to the original Supabase project. It does not replace the live Floot production domain.

## Confirmed staging implementation
- Public course/news/tip catalog from the existing `academy-gateway` Edge Function.
- Enrollment request and receipt workflow (not a verified payment gateway).
- Role-aware student, guardian, teacher and staff views behind authentication.
- Protected hash routes: `/#/portal`, `/#/parent`, `/#/teacher`, `/#/manage` (all resolve through the authenticated role, not the URL alone).
- Student learning journey, verified works, quiz, print-to-PDF resume and optional revocable showcase share through existing backend RPCs.
- Family daily micro-lessons and progress snapshot from the original Supabase database.
- 24 AI MISSION 90 templates; mission release/approval remains server-controlled.
- PWA manifest and offline public shell; Web Push and generative AI are NOT production-ready.

## Security boundary
- Public GitHub repo must contain no service-role keys, secrets or student PII.
- Frontend staff queries now explicitly project only the fields needed in each list; never fetch `select=*` for student, registration, or finance records.
- Existing RLS/RPC policies are the authorization source; a frontend role check alone is not a security boundary.
- Browser tests with mocked API responses do not constitute real authenticated E2E authorization tests.
- The public quota table currently lacks RLS but has no direct anon/authenticated table grants; audit before production.

## Remaining release blockers
1. Real authorized student/guardian/teacher/manager E2E tests, including cross-account negative access tests and consent revocation.
2. Contract, installment, finance, staff workflow and payment-provider migration and reconciliation.
3. Real Web Push permission/device test and server-side generative AI with quota and abuse controls.
4. Complete mobile/accessibility/performance QA, browser testing of the deployed Render URL, and a rollback drill.
5. Read-only Floot source audit after the daily limit resets; compare legacy behavior before migration.
6. The user's original video asset has not been supplied; no video integration is claimed.

## Rollback
Render auto-deploys this staging branch. Restore the last known-good Git commit to roll back the frontend; database migrations require their own separately tested reversal. Never reset production records or repoint the Floot production domain before E2E PASS and explicit owner approval.
