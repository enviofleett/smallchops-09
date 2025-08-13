interface EnvironmentCheck {
  isValid: boolean;
  message: string;
  level: 'error' | 'warning' | 'info';
}

interface EnvironmentStatus {
  isProductionReady: boolean;
  checks: EnvironmentCheck[];
  summary: string;
}

/**
 * Validates all required environment variables and configurations
 */
export function validateEnvironment(): EnvironmentStatus {
  const checks: EnvironmentCheck[] = [];
  
  // Critical environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  // Check Supabase configuration
  if (!supabaseUrl) {
    checks.push({
      isValid: false,
      message: 'VITE_SUPABASE_URL is missing - using hardcoded fallback',
      level: 'warning'
    });
  } else {
    checks.push({
      isValid: true,
      message: 'Supabase URL configured',
      level: 'info'
    });
  }
  
  if (!supabaseKey) {
    checks.push({
      isValid: false,
      message: 'VITE_SUPABASE_ANON_KEY is missing - using hardcoded fallback',
      level: 'warning'
    });
  } else {
    checks.push({
      isValid: true,
      message: 'Supabase anon key configured',
      level: 'info'
    });
  }
  
  // Check if we're in development mode
  const isDev = import.meta.env.DEV;
  if (isDev) {
    checks.push({
      isValid: true,
      message: 'Running in development mode',
      level: 'info'
    });
  } else {
    checks.push({
      isValid: true,
      message: 'Running in production mode',
      level: 'info'
    });
  }
  
  // Check for required DOM elements
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    checks.push({
      isValid: false,
      message: 'Root DOM element not found',
      level: 'error'
    });
  }
  
  // Check CSP configuration
  const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!cspMeta) {
    checks.push({
      isValid: false,
      message: 'Content Security Policy not configured',
      level: 'warning'
    });
  } else {
    checks.push({
      isValid: true,
      message: 'Content Security Policy configured',
      level: 'info'
    });
  }
  
  const errorCount = checks.filter(c => c.level === 'error').length;
  const warningCount = checks.filter(c => c.level === 'warning').length;
  
  const isProductionReady = errorCount === 0;
  
  let summary = '';
  if (errorCount > 0) {
    summary = `❌ ${errorCount} critical error(s) found - app may not function properly`;
  } else if (warningCount > 0) {
    summary = `⚠️ ${warningCount} warning(s) found - app is functional but some features may be degraded`;
  } else {
    summary = '✅ All environment checks passed';
  }
  
  return {
    isProductionReady,
    checks,
    summary
  };
}

/**
 * Logs environment status to console with appropriate formatting
 */
export function logEnvironmentStatus(): EnvironmentStatus {
  const status = validateEnvironment();
  
  console.group('🔍 Environment Validation');
  console.log(status.summary);
  
  status.checks.forEach(check => {
    const emoji = check.level === 'error' ? '❌' : check.level === 'warning' ? '⚠️' : '✅';
    const method = check.level === 'error' ? 'error' : check.level === 'warning' ? 'warn' : 'info';
    console[method](`${emoji} ${check.message}`);
  });
  
  console.groupEnd();
  
  return status;
}

/**
 * Shows a user-friendly error for environment issues
 */
export function createEnvironmentErrorElement(status: EnvironmentStatus): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: hsl(0 0% 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    font-family: system-ui, -apple-system, sans-serif;
  `;
  
  const card = document.createElement('div');
  card.style.cssText = `
    background: hsl(0 0% 100%);
    border: 1px solid hsl(0 0% 90%);
    border-radius: 12px;
    padding: 32px;
    max-width: 500px;
    box-shadow: 0 10px 30px -10px hsl(0 0% 0% / 0.1);
  `;
  
  card.innerHTML = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <h1 style="color: hsl(0 0% 20%); font-size: 24px; font-weight: 600; margin: 0 0 8px 0;">Configuration Issue</h1>
      <p style="color: hsl(0 0% 50%); margin: 0;">${status.summary}</p>
    </div>
    
    <div style="background: hsl(0 0% 98%); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h3 style="color: hsl(0 0% 30%); font-size: 16px; margin: 0 0 12px 0;">Issues Found:</h3>
      <ul style="color: hsl(0 0% 40%); font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.5;">
        ${status.checks
          .filter(c => c.level === 'error' || c.level === 'warning')
          .map(c => `<li>${c.message}</li>`)
          .join('')}
      </ul>
    </div>
    
    <div style="text-align: center;">
      <button 
        onclick="window.location.reload()" 
        style="
          background: hsl(221 83% 53%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          margin-right: 12px;
        "
      >
        Retry
      </button>
      <button 
        onclick="console.table(${JSON.stringify(status.checks)})" 
        style="
          background: hsl(0 0% 90%);
          color: hsl(0 0% 30%);
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        "
      >
        Show Details
      </button>
    </div>
  `;
  
  container.appendChild(card);
  return container;
}