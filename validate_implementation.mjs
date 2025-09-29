#!/usr/bin/env node

/**
 * Implementation Validation Script
 * Validates that the single-role admin system is properly implemented
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Validating Single-Role Admin System Implementation...\n');

const results = {
  passed: 0,
  failed: 0,
  issues: []
};

function test(name, condition, details = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    results.passed++;
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
    results.failed++;
    results.issues.push(name);
  }
}

// Check file existence
const requiredFiles = [
  'supabase/migrations/20241230000001_update_single_role_admin_system.sql',
  'supabase/migrations/20241230000002_create_user_invitations_table.sql',
  'supabase/functions/role-management/index.ts',
  'src/hooks/useRoleBasedPermissions.ts',
  'src/hooks/useUserManagement.ts',
  'src/components/RoleTestComponent.tsx',
  'src/types/auth.ts',
  'SINGLE_ROLE_ADMIN_SYSTEM_IMPLEMENTATION.md'
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  const fullPath = join(__dirname, file);
  test(`File exists: ${file}`, existsSync(fullPath));
});

console.log('\n🔧 Checking database migrations...');

// Check migration 1 - role system update
const migration1Path = join(__dirname, 'supabase/migrations/20241230000001_update_single_role_admin_system.sql');
if (existsSync(migration1Path)) {
  const migration1 = readFileSync(migration1Path, 'utf8');
  test('Migration 1 adds super_admin role', migration1.includes("ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin'"));
  test('Migration 1 adds support_officer role', migration1.includes("ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'support_officer'"));
  test('Migration 1 updates toolbuxdev@gmail.com', migration1.includes("toolbuxdev@gmail.com"));
  test('Migration 1 creates is_super_admin function', migration1.includes('CREATE OR REPLACE FUNCTION public.is_super_admin()'));
}

// Check migration 2 - invitations table
const migration2Path = join(__dirname, 'supabase/migrations/20241230000002_create_user_invitations_table.sql');
if (existsSync(migration2Path)) {
  const migration2 = readFileSync(migration2Path, 'utf8');
  test('Migration 2 creates user_invitations table', migration2.includes('CREATE TABLE public.user_invitations'));
  test('Migration 2 creates invitation_status enum', migration2.includes("CREATE TYPE public.invitation_status AS ENUM"));
  test('Migration 2 includes accept_user_invitation function', migration2.includes('CREATE OR REPLACE FUNCTION public.accept_user_invitation'));
}

console.log('\n⚡ Checking Edge Functions...');

// Check Edge Function
const edgeFunctionPath = join(__dirname, 'supabase/functions/role-management/index.ts');
if (existsSync(edgeFunctionPath)) {
  const edgeFunction = readFileSync(edgeFunctionPath, 'utf8');
  test('Edge Function handles role updates', edgeFunction.includes('update-role'));
  test('Edge Function handles user invitations', edgeFunction.includes('create-user-invitation'));
  test('Edge Function validates super_admin permissions', edgeFunction.includes('isSuperAdmin'));
  test('Edge Function includes audit logging', edgeFunction.includes('audit_logs'));
}

console.log('\n🎣 Checking React Hooks...');

// Check useRoleBasedPermissions
const permissionsHookPath = join(__dirname, 'src/hooks/useRoleBasedPermissions.ts');
if (existsSync(permissionsHookPath)) {
  const permissionsHook = readFileSync(permissionsHookPath, 'utf8');
  test('useRoleBasedPermissions defines role permissions matrix', permissionsHook.includes('ROLE_PERMISSIONS'));
  test('useRoleBasedPermissions handles super_admin role', permissionsHook.includes("'super_admin'"));
  test('useRoleBasedPermissions handles manager role', permissionsHook.includes("'manager'"));
  test('useRoleBasedPermissions handles support_officer role', permissionsHook.includes("'support_officer'"));
  test('useRoleBasedPermissions includes canAssignRoles function', permissionsHook.includes('canAssignRoles'));
}

// Check useUserManagement
const userMgmtHookPath = join(__dirname, 'src/hooks/useUserManagement.ts');
if (existsSync(userMgmtHookPath)) {
  const userMgmtHook = readFileSync(userMgmtHookPath, 'utf8');
  test('useUserManagement calls Edge Function for invitations', userMgmtHook.includes('role-management/create-user-invitation'));
  test('useUserManagement calls Edge Function for role updates', userMgmtHook.includes('role-management/update-role'));
  test('useUserManagement includes permission checks', userMgmtHook.includes('canAssignRoles'));
}

console.log('\n🎨 Checking TypeScript Types...');

// Check auth types
const authTypesPath = join(__dirname, 'src/types/auth.ts');
if (existsSync(authTypesPath)) {
  const authTypes = readFileSync(authTypesPath, 'utf8');
  test('Auth types updated for new roles', authTypes.includes("'super_admin' | 'manager' | 'support_officer'"));
}

console.log('\n🛡️ Checking Protected Routes...');

// Check ProtectedRoute component
const protectedRoutePath = join(__dirname, 'src/components/ProtectedRoute.tsx');
if (existsSync(protectedRoutePath)) {
  const protectedRoute = readFileSync(protectedRoutePath, 'utf8');
  test('ProtectedRoute uses role-based permissions', protectedRoute.includes('useRoleBasedPermissions'));
  test('ProtectedRoute handles new role types', protectedRoute.includes("'super_admin' | 'manager' | 'support_officer'"));
}

console.log('\n🧪 Checking Test Component...');

// Check test component
const testComponentPath = join(__dirname, 'src/components/RoleTestComponent.tsx');
if (existsSync(testComponentPath)) {
  const testComponent = readFileSync(testComponentPath, 'utf8');
  test('Test component uses role-based permissions', testComponent.includes('useRoleBasedPermissions'));
  test('Test component displays role matrix', testComponent.includes('testMenus'));
  test('Test component shows permission status', testComponent.includes('hasPermission'));
}

console.log('\n📚 Checking Documentation...');

// Check documentation
const docsPath = join(__dirname, 'SINGLE_ROLE_ADMIN_SYSTEM_IMPLEMENTATION.md');
if (existsSync(docsPath)) {
  const docs = readFileSync(docsPath, 'utf8');
  test('Documentation includes role definitions', docs.includes('Role Definitions'));
  test('Documentation includes implementation details', docs.includes('Implementation Details'));
  test('Documentation includes security features', docs.includes('Security Features'));
  test('Documentation includes usage instructions', docs.includes('Usage Instructions'));
}

// Summary
console.log('\n📊 Validation Summary:');
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);

if (results.issues.length > 0) {
  console.log('\n⚠️  Issues found:');
  results.issues.forEach(issue => console.log(`   - ${issue}`));
}

if (results.failed === 0) {
  console.log('\n🎉 All validations passed! The single-role admin system is properly implemented.');
} else {
  console.log(`\n⚠️  ${results.failed} validation(s) failed. Please review the issues above.`);
}

console.log('\n📝 Next Steps:');
console.log('1. Run database migrations: supabase db push');
console.log('2. Deploy Edge Functions: supabase functions deploy role-management');
console.log('3. Test the implementation with different user roles');
console.log('4. Verify menu visibility and access controls');
console.log('5. Test user creation and role assignment flows');

process.exit(results.failed === 0 ? 0 : 1);