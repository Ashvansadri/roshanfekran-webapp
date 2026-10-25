-- Only use after checking if any phone-only guardians have been invited/claimed.
-- Never remove guardian records or relationships created during the live period.
BEGIN;
REVOKE ALL ON FUNCTION public.academy_guardian_phone_invite(uuid,text,text,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.academy_guardian_phone_claim() FROM authenticated;
-- Functions and supporting table retained for audit and safe backward compatibility.
-- Do NOT restore NOT NULL on email until all phone-only guardians get real emails,
-- and only after an explicit data review and user approval.
COMMIT;