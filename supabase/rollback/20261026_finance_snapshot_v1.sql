-- Reverts only the read-only finance snapshot RPC; never touches student or payment data.
drop function if exists public.academy_finance_reconciliation_snapshot();
