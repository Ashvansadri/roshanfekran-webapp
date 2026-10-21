# Roshanfekran migration to Render (staging)

This is a separate static frontend proof-of-concept; it is NOT yet a complete migration of Floot's app.

- Read-only public content comes from the EXISTING Supabase academy-gateway Edge Function `public_catalog`, `public_news` and `daily_public`.
- Registration, staff, student and guardian portals remain on the existing Floot Production site until their complete code, secure authentication, payment and mobile UI are migrated and tested. The staging site redirects to the existing site for those functions.
- No private database records, Supabase service-role keys, password or user PII are copied into this public repository. All dynamic public content is escaped before HTML insertion.
- No payment transactions are initiated on staging.
- The Render static site will build from the `roshanfekran-next-20261021` branch, using `echo ready` and publishPath `site`.
- The Floot source cannot currently be exported because its daily build-action limit is exhausted until 2026-10-22T00:00:00Z.
- Follow-up: export and migrate all Floot pages/components after reset, replace Floot-specific backend routes, audit auth/parent isolation, QA mobile and desktop, then switch production traffic.
- Do not point any public domain away from the live site before full regression and consent checks.
