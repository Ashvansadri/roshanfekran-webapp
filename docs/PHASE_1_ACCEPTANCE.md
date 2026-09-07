# Phase 1 Acceptance — Academy Control Center MVP

## Scope
- Student records
- Courses
- Enrollments
- Tuition and discount
- Installments
- Payments
- Dashboard KPIs
- Audit log

## Must pass before staging
- [ ] D1 schema applies without error
- [ ] Unauthorized API request is rejected outside development
- [ ] Student creation validates name and mobile
- [ ] Discount cannot exceed gross tuition
- [ ] Payment cannot exceed enrollment remaining balance
- [ ] Installment payment cannot exceed installment remaining balance
- [ ] Dashboard totals match fixture data
- [ ] Mobile layout has no horizontal page overflow except data table container
- [ ] No real student data is used in development tests
- [ ] Production remains unchanged

## Not yet in Phase 1
- Contract generation
- Receipt PDF
- CSV export
- Roles beyond admin allow-list
- Attendance
- Instructor payroll
- Messaging/SMS/WhatsApp
- Online payment gateway
- Final integration with legacy consultation CRM
