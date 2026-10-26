-- Restore previous read-only snapshot; no financial records changed.
-- Show up to 20 actionable overpayment cases alongside exact full-ledger totals.
-- Read-only, RLS-invoker, staff finance roles only. No change to payments or contracts.
create or replace function public.academy_finance_reconciliation_snapshot()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  overpaid_count bigint := 0;
  overpaid_excess numeric := 0;
  overpaid_cases jsonb := '[]'::jsonb;
begin
  if not public.academy_role_allowed(array['owner','manager','finance']) then
    raise exception 'Finance access denied' using errcode = '42501';
  end if;
  with discrepancies as (
    select e.id as enrollment_id, e.student_id, e.course_id, e.final_fee,
           sum(p.amount) as posted_total, sum(p.amount)-e.final_fee as excess
    from public.academy_enrollments e
    join public.academy_payments p on p.enrollment_id=e.id and p.status='posted'
    where e.final_fee is not null
    group by e.id,e.student_id,e.course_id,e.final_fee
    having sum(p.amount)>e.final_fee
  )
  select count(*), coalesce(sum(excess),0),
         coalesce((select jsonb_agg(to_jsonb(c) order by c.excess desc,c.enrollment_id)
                   from (select enrollment_id,student_id,course_id,final_fee,posted_total,excess
                         from discrepancies order by excess desc,enrollment_id limit 20) c),'[]'::jsonb)
    into overpaid_count,overpaid_excess,overpaid_cases
  from discrepancies;
  return jsonb_build_object(
    'as_of', now(),
    'posted_count', (select count(*) from public.academy_payments where status='posted'),
    'posted_total', (select coalesce(sum(amount),0) from public.academy_payments where status='posted'),
    'voided_count', (select count(*) from public.academy_payments where status='voided'),
    'open_installment_count', (select count(*) from public.academy_installments where status in ('open','partial')),
    'remaining_installments', (select coalesce(sum(greatest(amount-paid_amount,0)),0) from public.academy_installments where status in ('open','partial')),
    'missing_schedule_count', (
      select count(*) from public.academy_enrollments e
      where e.status in ('active','pending')
      and not exists (select 1 from public.academy_installments i where i.enrollment_id=e.id)
    ),
    'enrollment_count', (select count(*) from public.academy_enrollments),
    'overpaid_enrollment_count', overpaid_count,
    'overpaid_excess_total', overpaid_excess,
    'overpaid_cases', overpaid_cases
  );
end;
$$;
revoke all on function public.academy_finance_reconciliation_snapshot() from public, anon;
grant execute on function public.academy_finance_reconciliation_snapshot() to authenticated;
