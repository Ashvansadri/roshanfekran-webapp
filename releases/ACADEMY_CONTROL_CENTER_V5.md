# Academy Control Center v5 — Test Release

Preview URL:
https://roshanfekran-academy-control-v5-mwjn2wkw0.vercel.app

## Included in v5
- Professional RTL academy dashboard redesign
- Student profiles and financial summary
- Registration flow with discount, prepayment, and installment plan
- Payment flow with overpayment prevention in the demo UI
- Receipt generation
- Installment / receivables view
- Courses and capacity view
- Classes view
- Attendance interaction
- Certificate workflow gated by course completion + financial settlement
- Follow-up / task pipeline
- Management report, cash summary, collection-rate report
- JSON backup and CSV payment export
- Responsive mobile navigation

## Backend staging advanced in the same release
Supabase project: roshanfekran-webapp

Existing academy schema extended with:
- academy_followups
- academy_expenses
- academy_teacher_payouts
- academy_overdue_installments view
- academy_course_finance view
- academy_dashboard_summary view
- missing foreign-key indexes
- RLS enabled on newly added tables

Demo-only staging data loaded into the academy_* namespace:
- 5 departments
- 6 courses
- 20 students
- 17 enrollments
- 51 installments
- 37 payments
- 12 classes
- 6 follow-ups
- 3 expenses
- 1 teacher payout

## Financial guard verification
Database guard test confirmed:
- payment over enrollment balance is rejected
- installment from a different enrollment is rejected
- no guard-test payment row leaked into the ledger

## Current separation
The Vercel v5 preview is still an isolated DEMO UI. The Supabase academy backend is real staging infrastructure, but direct write connectivity is intentionally not enabled until staff authentication / role assignment is completed.
