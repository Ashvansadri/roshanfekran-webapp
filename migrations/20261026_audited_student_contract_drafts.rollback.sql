-- Roll back the RPC only. Existing contract drafts and audit history are preserved.
DROP FUNCTION IF EXISTS public.academy_create_student_contract_draft(uuid,uuid,text,date,date);
