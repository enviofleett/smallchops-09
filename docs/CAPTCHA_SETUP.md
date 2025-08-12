# CAPTCHA Implementation Guide

This guide explains how to configure and deploy the production-ready CAPTCHA system for authentication.

## 🚀 Quick Setup

### 1. Configure Supabase CAPTCHA

1. **Navigate to Supabase Dashboard**
   - Go to Authentication → Settings → Security
   - Enable CAPTCHA protection

2. **Configure CAPTCHA Provider**
   - Choose hCaptcha (recommended) or reCAPTCHA
   - Enter your site key and secret key
   - Set CAPTCHA thresholds

### 2. Get hCaptcha Keys

1. **Sign up at [hCaptcha](https://www.hcaptcha.com/)**
2. **Create a new site**
   - Add your domain(s)
   - Choose difficulty level
   - Get your site key and secret key

3. **Configure in Supabase**
   - Go to Auth → Settings → Security
   - Enter your hCaptcha secret key
   - Enable CAPTCHA for sign-in and sign-up

### 3. Update Site Key

Update the site key in `src/config/captcha.ts`:

```typescript
export const CAPTCHA_CONFIG = {
  SITE_KEY: 'YOUR_PRODUCTION_SITE_KEY_HERE'
  // ... rest of config
};
```

## 🛡️ Security Features

### Adaptive CAPTCHA
- Triggered after 2 failed login attempts
- Smart detection of suspicious behavior
- Rate limiting with progressive delays

### Protection Levels
1. **Level 1**: Normal authentication (no CAPTCHA)
2. **Level 2**: CAPTCHA after failed attempts
3. **Level 3**: Account lockout after excessive failures

### Rate Limiting
- 5 attempts per 5-minute window
- Progressive cooldown periods
- IP-based tracking (optional)

## 📊 Monitoring & Analytics

### Key Metrics
- CAPTCHA success/failure rates
- Authentication attempt patterns
- Security incident detection
- User experience impact

### Logs
```typescript
// Example security log entry
{
  "event": "captcha_required",
  "user_email": "user@example.com",
  "attempt_count": 3,
  "ip_address": "192.168.1.1",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 🔧 Configuration Options

### Security Thresholds
```typescript
SECURITY: {
  REQUIRE_AFTER_ATTEMPTS: 2,    // Show CAPTCHA after N failed attempts
  MAX_ATTEMPTS: 5,              // Max attempts before lockout
  COOLDOWN_PERIOD: 300000,      // Lockout duration (5 minutes)
}
```

### UI Customization
```typescript
UI: {
  THEME: 'light',        // 'light' | 'dark'
  SIZE: 'normal',        // 'normal' | 'compact'
  SHOW_RETRY: true,      // Show retry button on error
}
```

## 🧪 Testing

### Development Testing
1. **Use demo site key**: `10000000-ffff-ffff-ffff-000000000001`
2. **Test scenarios**:
   - Normal login (no CAPTCHA)
   - Failed attempts triggering CAPTCHA
   - CAPTCHA success/failure flows
   - Rate limiting behavior

### Production Testing
1. **Verify CAPTCHA appears after failed attempts**
2. **Test with different browsers/devices**
3. **Check accessibility compliance**
4. **Monitor error rates and user feedback**

## 🚨 Error Handling

### Common Errors
| Error | Cause | Solution |
|-------|-------|----------|
| `network-error` | Connection issues | Check internet, retry |
| `challenge-timeout` | User took too long | Refresh CAPTCHA |
| `invalid-response` | Malformed token | Regenerate CAPTCHA |
| `rate-limited` | Too many attempts | Wait for cooldown |

### Error Recovery
- Automatic retry mechanisms
- Clear error messages
- Fallback options for accessibility
- Support contact information

## 🔐 Security Best Practices

### Implementation
✅ **Do:**
- Use HTTPS for all authentication endpoints
- Validate CAPTCHA tokens server-side
- Implement proper rate limiting
- Log security events for monitoring
- Test with real users before deployment

❌ **Don't:**
- Store CAPTCHA tokens in localStorage
- Skip server-side validation
- Use the same site key across environments
- Ignore accessibility requirements
- Deploy without proper testing

### Compliance
- **GDPR**: Document CAPTCHA data collection
- **WCAG**: Ensure accessibility compliance
- **Privacy**: Minimize data collection
- **Security**: Regular security audits

## 📈 Performance Impact

### Metrics to Monitor
- Page load time increase
- Authentication completion rates
- User abandonment at CAPTCHA step
- False positive/negative rates

### Optimization
- Lazy load CAPTCHA components
- Preload CAPTCHA scripts
- Use CDN for faster loading
- Monitor and adjust thresholds

## 🆘 Troubleshooting

### Common Issues

**CAPTCHA not appearing:**
1. Check site key configuration
2. Verify domain settings in hCaptcha
3. Check browser console for errors
4. Ensure HTTPS is enabled

**Authentication still failing:**
1. Verify secret key in Supabase
2. Check server-side validation
3. Monitor authentication logs
4. Test with different browsers

**High false positive rate:**
1. Adjust attempt thresholds
2. Review IP reputation settings
3. Consider user feedback
4. Analyze usage patterns

### Support Resources
- [hCaptcha Documentation](https://docs.hcaptcha.com/)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## 🚀 Deployment Checklist

- [ ] hCaptcha account created and configured
- [ ] Site key updated in configuration
- [ ] Secret key added to Supabase
- [ ] CAPTCHA enabled in Supabase Auth settings
- [ ] Thresholds configured appropriately
- [ ] Testing completed across browsers/devices
- [ ] Error handling verified
- [ ] Monitoring/logging configured
- [ ] Documentation updated
- [ ] Team trained on new security features