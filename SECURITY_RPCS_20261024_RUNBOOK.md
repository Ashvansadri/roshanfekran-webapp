# 2026-10-24 — SECURITY DEFINER NULL-role guard hardening

**Scope:** 26 existing `public.academy_*` RPCs in the shared Supabase project. These functions use `SECURITY DEFINER` and were callable by the `authenticated` database role. No table rows, function signatures, role grants, or production Floot routes were changed.

## Root cause

In PL/pgSQL, an `IF` body runs only when its condition is **TRUE**. If a staff lookup returns no row, `v_role` is NULL. Therefore `IF v_role NOT IN (...) THEN RAISE` and `IF v_role <> 'teacher' THEN RAISE` both evaluate to NULL, **not TRUE**, and do not deny access. Composite guards such as `IF NOT (v_role IN (...) OR EXISTS (...)) THEN RAISE` can fail open for the same reason when the `EXISTS` branch is false.

## Applied database migrations

1. `migrations/20261024_fail_closed_staff_rpc_null_roles.sql` — 16 `NOT IN` guards now use `coalesce(v_role, '')`, and 2 `<>` guards use `IS DISTINCT FROM`.
2. `migrations/20261024_fail_closed_composite_teacher_guards.sql` — 8 manager/teacher composite guards use null-safe role comparisons, including the secondary teacher role check in course completion.

Each migration checks for its expected original source text and aborts if a guard has changed. The changes were applied via Supabase migration tooling, not by editing tables.

## QA

- `migrations/20261024_fail_closed_staff_rpc_null_roles.verify.sql`: asserts 18/18 corrected function definitions and four negative, read-only no-JWT calls.
- `migrations/20261024_fail_closed_composite_teacher_guards.verify.sql`: asserts 8/8 corrected composite guards and NULL-role boolean semantics.
- Read-only counts checked: 26 students, 7 courses, 15 enrollments.
- GitHub Actions source checks and browser smoke remain required for every commit.
- **Not verified:** successful login with a consented real account, positive role authorization, complete RPC authorization audit, financial payment flow, or production readiness.

## Safe rollback / containment

**Do not restore the old NULL-unsafe guards.** Reverting them reintroduces an authorization vulnerability. If an unexpected legitimate-role regression is observed:

1. Keep Floot production unchanged and stop promoting staging.
2. Identify the affected RPC and compare its stored definition to the migration and its verify SQL.
3. If an immediate containment is needed, temporarily deny direct `authenticated` execution on **only that affected RPC**, for example `REVOKE EXECUTE ON FUNCTION public.academy_inspection_snapshot() FROM authenticated;` (after checking for inherited/PUBLIC grants). This may temporarily disable that operation in both staging and Floot.
4. Apply a corrected, fail-closed role check in a new forward migration; regrant only the originally required permissions.
5. Re-run the SQL verification, positive/negative role tests with explicitly consented accounts, CI, Render deployment checks, and browser smoke.

Never impersonate an existing user, reset passwords, expose service-role keys, or delete live records to test authorization.
