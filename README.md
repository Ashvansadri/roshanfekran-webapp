# Roshanfekran Academy Control Center

MVP امن و مستقل برای سامان‌دهی ثبت‌نام، شهریه، اقساط و پرداخت‌های آموزشگاه روشنفکران.

## وضعیت
این نسخه فقط روی branch `academy-control-center-mvp` است و Production را تغییر نمی‌دهد.

## ماژول‌های فعلی
- داشبورد مدیریتی: کل هنرجو، ثبت‌نام فعال، درآمد ماه، مطالبات، اقساط عقب‌افتاده
- پرونده هنرجو
- دوره‌ها
- ثبت‌نام در دوره
- تخفیف و شهریه نهایی
- اقساط و سررسید
- ثبت پرداخت و کنترل بیش‌پرداخت
- Audit Log
- احراز دسترسی مبتنی بر Cloudflare Access header

## دیتابیس
D1 schema در `schema.sql` شامل:
`students`, `courses`, `enrollments`, `installments`, `payments`, `audit_log`

مبالغ به صورت عدد صحیح و با واحد تومان ذخیره می‌شوند.

## اجرای محلی
1. `npm install`
2. `npm run db:local`
3. `npm run dev`

در حالت development اگر Cloudflare Access header وجود نداشته باشد، actor برابر `local-dev` می‌شود. این رفتار نباید در Production فعال بماند.

## قبل از Staging
1. یک D1 مخصوص Staging بسازید.
2. مقدار `database_id` در `wrangler.toml` را جایگزین کنید.
3. `ENVIRONMENT` را از `development` به `staging` تغییر دهید.
4. `ADMIN_EMAILS` را با ایمیل‌های مجاز پر کنید.
5. Cloudflare Access را برای مسیر پنل فعال کنید.
6. schema را ابتدا روی D1 Staging اجرا کنید.
7. Smoke Test و سپس QA مالی انجام دهید.

## قواعد مالی مهم
- Payment بیشتر از مانده کل ثبت‌نام رد می‌شود.
- اگر پرداخت به قسط متصل باشد، بیشتر از مانده همان قسط رد می‌شود.
- هر عملیات اصلی در Audit Log ثبت می‌شود.
- حذف مالی در MVP عمداً پیاده نشده تا سوابق ناخواسته پاک نشوند.

## مرحله بعد
اتصال این هسته به CRM موجود آموزشگاه و افزودن صفحات کامل ثبت‌نام، قرارداد، رسید، گزارش مالی، خروجی CSV و سطح دسترسی نقش‌ها.
