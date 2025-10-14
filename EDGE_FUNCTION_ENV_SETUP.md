# Edge Function Environment Variables Setup

## Required Configuration

To complete the CORS security implementation, you need to set these environment variables in your Supabase project:

### Steps:

1. Go to: [Edge Functions Environment Variables Settings](https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions)

2. Add the following environment variables:

| Variable Name | Value |
|--------------|-------|
| `DENO_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://startersmallchops.com,https://www.startersmallchops.com` |
| `ALLOW_PREVIEW_ORIGINS` | `false` |

### What These Do:

- **DENO_ENV**: Sets the environment to production mode, enabling strict CORS validation
- **ALLOWED_ORIGINS**: Defines the exact domains that can access your Edge Functions
- **ALLOW_PREVIEW_ORIGINS**: Disables preview/development domain access in production (set to `false` for maximum security)

### After Setup:

Once these variables are set:
- All Edge Functions will automatically enforce strict CORS
- Only requests from `startersmallchops.com` and `www.startersmallchops.com` will be allowed
- Preview/development URLs will be blocked in production mode

### Testing:

After setting the variables, your Edge Functions will automatically use the new configuration. No redeployment needed.
