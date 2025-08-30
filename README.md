# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/bcf6b922-d18e-44c0-ae6a-54a3a8295ebc

## Production-Ready Email System

This project now includes a production-ready email system with the following features:

### ✅ Email Delivery & Reliability
- **Persistent Delivery Logging**: All sent emails are logged to `email_delivery_logs` table with comprehensive tracking
- **Retry Logic**: Failed emails are automatically retried up to 3 times with exponential backoff
- **Bounce/Complaint Tracking**: Automatic detection and suppression of bad email addresses
- **Rate Limiting**: Configurable rate limits to prevent SMTP provider throttling

### 🚨 Monitoring & Alerting
- **Failure Monitoring**: Automatic detection of repeated email failures
- **Admin Alerts**: Email and Slack notifications for critical issues
- **Health Metrics**: Real-time email system health dashboard
- **Audit Logging**: Complete audit trail of all email operations

### 🔧 Configuration

The email system can be configured via environment variables in your `.env` file:

```bash
# Admin Email for Critical Alerts
ADMIN_ALERT_EMAIL=admin@your-domain.com

# Slack Integration (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Email Failure Monitoring Thresholds
EMAIL_FAILURE_THRESHOLD=5
EMAIL_FAILURE_WINDOW_HOURS=1

# SMTP Rate Limiting Configuration
SMTP_RATE_LIMIT_PER_HOUR=100
SMTP_RATE_LIMIT_PER_MINUTE=10
SMTP_RATE_LIMIT_BURST=5

# Email Delivery Logging Configuration
EMAIL_LOG_RETENTION_DAYS=30
EMAIL_LOG_LEVEL=info

# Email Suppression List Configuration
AUTO_SUPPRESS_HARD_BOUNCES=true
AUTO_SUPPRESS_COMPLAINTS=true
SUPPRESS_AFTER_BOUNCES=3
SUPPRESS_AFTER_COMPLAINTS=1
```

### 📊 Email Monitoring Functions

The system includes several Supabase Edge Functions for email monitoring:

- **`email-failure-alerting`**: Monitors for repeated failures and sends alerts
- **`email-production-monitor`**: Provides health metrics and system status
- **`bounce-complaint-processor`**: Handles bounce and complaint events
- **`enhanced-email-retry`**: Manages email retry logic
- **`email-core`**: Core email processing with rate limiting and suppression

### 🔍 Monitoring Dashboard

Access email delivery metrics via the frontend or by calling:

```sql
-- Get email delivery metrics for last 24 hours
SELECT * FROM get_email_delivery_metrics(24);
```

### 📋 Suppression List Management

The system automatically manages email suppressions but you can also manually manage them:

```sql
-- View suppressed emails
SELECT * FROM email_suppression_list WHERE is_active = true;

-- Manually suppress an email
INSERT INTO email_suppression_list (email, suppression_type, reason)
VALUES ('bad@email.com', 'manual', 'Customer requested suppression');
```

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/bcf6b922-d18e-44c0-ae6a-54a3a8295ebc) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Database & Edge Functions)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/bcf6b922-d18e-44c0-ae6a-54a3a8295ebc) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
