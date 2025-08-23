// Utility functions for SMTP sender modules

export function maskSMTPConfig(config) {
  // Mask SMTP password and user for logging
  return {
    ...config,
    user: config.user ? config.user.replace(/.(?=.{2})/g, '*') : undefined,
    pass: config.pass ? '***MASKED***' : undefined
  };
}

export function troubleshootingGuide(error) {
  // Provide actionable tips based on error
  let tips = [];
  if (error && error.code === 'ECONNECTION') {
    tips.push('Check SMTP host and port configuration.');
    tips.push('If using port 587, ensure STARTTLS is enabled on provider.');
    tips.push('Try alternate SMTP provider host if available.');
  }
  if (error && error.code === 'EAUTH') {
    tips.push('Validate SMTP username and password.');
    tips.push('Check sender email matches provider requirements.');
  }
  tips.push('See runbook for escalation steps.');
  return tips.join(' ');
}