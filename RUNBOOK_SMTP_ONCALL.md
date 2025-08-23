# SMTP On-Call Runbook

## Health Dashboards
- Dashboard: [SMTP Delivery Metrics](https://your.monitoring.service/smtp)
- Batch size adjustment: See section below

## Troubleshooting Steps
- If delivery fails:
  1. Check connection logs, validate SMTP_HOST and port.
  2. Try alternate provider hosts (documented above).
  3. Review error details in `smtp_delivery_confirmations` and health metrics.
- For persistent errors, escalate to provider support.

## Batch Size Adjustment
- Update `smtp_batch_size` in DB via admin panel or SQL query:
  ```sql
  UPDATE communication_settings SET smtp_batch_size = 250 WHERE id = ...;
  ```

## Error Logging
- All errors log masked config and troubleshooting guidance for on-call.
- Reference provider_response and error_message columns for clues.

## Contacts & Escalation
- [On-call Slack channel](https://your.slack.com/channel/oncall)