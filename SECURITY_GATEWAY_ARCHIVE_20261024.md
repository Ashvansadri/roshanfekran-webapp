# Academy Gateway — archived student access hardening (2026-10-24)

## Scope and provenance
- Staging repository: `Ashvansadri/roshanfekran-webapp`, branch `roshanfekran-next-20261021`.
- Server-side source of truth: `supabase/functions/academy-gateway/index.ts` (never included in `site/`).
- Supabase project: `sdsdzktsqpahpdrgmzuo`, function `academy-gateway`, deployed version **41** (prior version **40**).
- Edge function retains its existing `verify_jwt=false` setting because it handles public entry points and authenticates protected actions internally. Do not remove per-action authorization.
- No credential, secret value, JWT, or service-role token is committed. Server code reads credentials from runtime environment only.

## Changes
1. The server-side `studentByUser` lookup now reads both `status` and `archived_at`, and rejects any archived record before service-role-backed upload, document, finance, daily learning, or notification actions.
2. `resolve_portal` no longer resolves an archived student with a missing `archived_at` timestamp as an active student.
3. Student invitations, invited-account activation, guardian invitations, admin portal reactivation, and targeted avatar changes reject archived records before writes.
4. Active staff avatar changes remain available even if the staff account has a separate archived student record.
5. The standalone frontend hides archived students from new account invitations and one-click family linking.

## Read-only verification
- `node scripts/verify.mjs` runs `scripts/gateway-archive.test.mjs`, covering active, status-only archived, date-only archived, and missing students.
- Check GitHub Actions source checks and browser smoke for the exact commit.
- Confirm edge function status ACTIVE, version >=41 and the two archive guards in its deployed source.
- Send unauthenticated `resolve_portal`: expected HTTP 401 / `AUTH_REQUIRED`.
- Send unauthenticated `proxy` to private REST RPC: expected denial.
- Verify live Render HTML and JS assets load. These checks do **not** replace positive testing with an authorized user.

## Rollback and incident response
- Do not reset accounts, change production Floot, or delete academy records.
- If the **frontend** fails, restore the last verified frontend commit/deploy independently; this does not roll back the Supabase function.
- If the **edge function** fails, first fix the regression in the tracked server source and redeploy with the same secure archive checks. Confirm the live function version and repeat negative checks.
- Only as an emergency availability trade-off, an authorized operator may restore the prior Supabase deployment version 40 **if that version is still available**. Version 40 did not contain these archive guards and must not be treated as secure or as a permanent rollback target.
- Keep the Floot production app running until real-account login, role/RLS, payment, parent consent, and push tests are completed.

## Outstanding acceptance criteria
Authorized-account positive login and refresh, real guardian/teacher role isolation, finance sandbox payment and reconciliation, mobile PWA installation, and opt-in Push remain unverified.
