-- Read-only, exact (uncapped) staff finance totals. No personal records returned.
-- SECURITY INVOKER retains each caller's RLS restrictions.
create or replace function public.academy_finance_reconciliation_snapshot()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.academy_role_allowed(array['owner','manager','finance']) then
    raise exception 'Finance access denied' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'as_of', now(),
    'posted_count', (select count(*) from public.academy_payments where status = 'posted'),
    'posted_total', (select coalesce(sum(amount),0) from public.academy_payments where status = 'posted'),
    'voided_count', (select count(*) from public.academy_payments where status = 'voided'),
    'open_installment_count', (select count(*) from public.academy_installments where status in ('open','partial')),
    'remaining_installments', (select coalesce(sum(greatest(amount - paid_amount,0)),0) from public.academy_installments where status in ('open','partial')),
    'missing_schedule_count', (
      select count(*) from public.academy_enrollments e
      where e.status in ('active','pending')
      and not exists (select 1 from public.academy_installments i where i.enrollment_id=e.id)
    ),
    'enrollment_count', (select count(*) from public.academy_enrollments)
  );
end;
$$;

revoke all on function public.academy_finance_reconciliation_snapshot() from public, anon;
grant execute on function public.academy_finance_reconciliation_snapshot() to authenticated;

