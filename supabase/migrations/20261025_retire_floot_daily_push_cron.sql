-- Safe decommission of legacy Floot-hosted daily Push web hook.
-- No active device subscriptions existed during cutover; do not delete cron or logs.
SELECT cron.alter_job(job_id:=2, active:=false);