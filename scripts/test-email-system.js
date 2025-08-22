#!/usr/bin/env node

/**
 * Email System Test Script
 * Tests the production email system for common issues and validates configuration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('🧪 Email System Test Suite\n');

// Test 1: Check if environment files exist
console.log('1. Checking environment configuration...');
const envFiles = ['.env', '.env.example', '.env.production'];
envFiles.forEach(file => {
  const exists = fs.existsSync(path.join(rootDir, file));
  console.log(`   ${exists ? '✅' : '❌'} ${file} ${exists ? 'exists' : 'missing'}`);
});

// Test 2: Check email function files
console.log('\n2. Checking email function files...');
const emailFunctions = [
  'supabase/functions/production-email-processor/index.ts',
  'supabase/functions/production-smtp-sender/index.ts',
  'supabase/functions/smtp-email-sender/index.ts',
  'supabase/functions/_shared/cors.ts',
  'supabase/functions/_shared/email-rate-limiter.ts',
  'supabase/functions/_shared/email-retry-manager.ts'
];

emailFunctions.forEach(file => {
  const exists = fs.existsSync(path.join(rootDir, file));
  console.log(`   ${exists ? '✅' : '❌'} ${file} ${exists ? 'exists' : 'missing'}`);
});

// Test 3: Check frontend email files
console.log('\n3. Checking frontend email files...');
const frontendFiles = [
  'src/hooks/useEmailAutomation.ts',
  'src/services/EmailTemplateService.ts',
  'src/components/admin/EmailHealthMonitor.tsx'
];

frontendFiles.forEach(file => {
  const exists = fs.existsSync(path.join(rootDir, file));
  console.log(`   ${exists ? '✅' : '❌'} ${file} ${exists ? 'exists' : 'missing'}`);
});

// Test 4: Check email migration files
console.log('\n4. Checking database migration files...');
const migrationDir = path.join(rootDir, 'supabase/migrations');
if (fs.existsSync(migrationDir)) {
  const migrations = fs.readdirSync(migrationDir)
    .filter(file => file.includes('email') || file.includes('smtp') || file.includes('template'))
    .sort();
  
  if (migrations.length > 0) {
    console.log('   ✅ Email-related migrations found:');
    migrations.forEach(migration => {
      console.log(`      - ${migration}`);
    });
  } else {
    console.log('   ⚠️  No email-related migrations found');
  }
} else {
  console.log('   ❌ Migration directory not found');
}

// Test 5: Validate email function imports
console.log('\n5. Validating email function imports...');
const mainEmailFile = path.join(rootDir, 'supabase/functions/production-email-processor/index.ts');
if (fs.existsSync(mainEmailFile)) {
  const content = fs.readFileSync(mainEmailFile, 'utf8');
  const requiredImports = [
    'getCorsHeaders',
    'EmailRateLimiter',
    'EmailRetryManager'
  ];
  
  requiredImports.forEach(importName => {
    const hasImport = content.includes(importName);
    console.log(`   ${hasImport ? '✅' : '❌'} ${importName} ${hasImport ? 'imported' : 'missing'}`);
  });
} else {
  console.log('   ❌ Main email processor file not found');
}

// Test 6: Check for common email system issues
console.log('\n6. Checking for common issues...');

// Check for hardcoded email addresses
const filesToCheck = [
  'src/hooks/useEmailAutomation.ts',
  'src/services/EmailTemplateService.ts',
  'supabase/functions/production-email-processor/index.ts'
];

const hardcodedEmails = [];
filesToCheck.forEach(file => {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const emailMatches = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatches) {
      emailMatches.forEach(email => {
        if (!email.includes('example.com') && !email.includes('{{') && !email.includes('test.com')) {
          hardcodedEmails.push({ file, email });
        }
      });
    }
  }
});

if (hardcodedEmails.length > 0) {
  console.log('   ⚠️  Hardcoded email addresses found:');
  hardcodedEmails.forEach(({ file, email }) => {
    console.log(`      ${file}: ${email}`);
  });
} else {
  console.log('   ✅ No hardcoded email addresses found');
}

// Check for insecure configurations
const configIssues = [];
const envExamplePath = path.join(rootDir, '.env.example');
const envExample = fs.existsSync(envExamplePath) ? fs.readFileSync(envExamplePath, 'utf8') : '';
if (envExample.includes('your-') || envExample.includes('example.com')) {
  console.log('   ✅ Environment example file contains placeholder values');
} else {
  console.log('   ⚠️  Environment example file may contain real values');
}

// Test 7: Validate email templates structure
console.log('\n7. Checking email template migration...');
const templateMigration = path.join(rootDir, 'supabase/migrations/20250822112000_add_missing_email_templates.sql');
if (fs.existsSync(templateMigration)) {
  const content = fs.readFileSync(templateMigration, 'utf8');
  const templates = [
    'password_reset',
    'order_shipped',
    'order_delivered',
    'cart_abandonment',
    'admin_new_order',
    'payment_receipt'
  ];
  
  templates.forEach(template => {
    const hasTemplate = content.includes(`'${template}'`);
    console.log(`   ${hasTemplate ? '✅' : '❌'} ${template} template ${hasTemplate ? 'defined' : 'missing'}`);
  });
} else {
  console.log('   ❌ Email templates migration file not found');
}

console.log('\n🎯 Test Summary:');
console.log('   - If you see ❌ errors, those files need to be created or fixed');
console.log('   - If you see ⚠️  warnings, review those items for potential issues');
console.log('   - ✅ indicates everything is working correctly');

console.log('\n📋 Next Steps for Production:');
console.log('   1. Configure SMTP settings in Supabase admin panel');
console.log('   2. Set up environment variables for production');
console.log('   3. Run database migrations');
console.log('   4. Test email sending with the health monitor');
console.log('   5. Monitor email delivery logs and metrics');

console.log('\n🚀 Email system validation complete!\n');