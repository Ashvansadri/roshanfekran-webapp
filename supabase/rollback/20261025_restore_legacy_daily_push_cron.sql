-- Activate this only after configuring a replacement approved sender or consciously restoring the legacy provider.
SELECT cron.alter_job(job_id:=2, active:=true);