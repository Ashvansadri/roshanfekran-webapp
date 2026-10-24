-- Emergency rollback of the additive attendance APIs only; does not delete attendance data.
DROP FUNCTION IF EXISTS public.academy_mark_class_attendance(uuid,uuid,text,text);
DROP FUNCTION IF EXISTS public.academy_attendance_roster(uuid);
