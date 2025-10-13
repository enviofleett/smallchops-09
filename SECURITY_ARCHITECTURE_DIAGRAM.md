# SECURITY ARCHITECTURE DIAGRAM
## Visual Guide to Security Layers

**Date:** October 13, 2025  
**Purpose:** Visual representation of security controls

---

## LAYER 1: DATABASE ROW LEVEL SECURITY (RLS)

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (PostgreSQL)               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │  CUSTOMER A  │        │  CUSTOMER B  │                   │
│  │   (user_id)  │        │   (user_id)  │                   │
│  └──────┬───────┘        └──────┬───────┘                   │
│         │                        │                           │
│         ▼                        ▼                           │
│  ┌──────────────────────────────────────┐                   │
│  │         ORDERS TABLE                  │                   │
│  │  RLS: customer_id = auth.uid()       │                   │
│  ├──────────────────────────────────────┤                   │
│  │ Order #1 | Customer A | $50  ✅      │ ← Customer A sees │
│  │ Order #2 | Customer B | $30  ❌      │ ← Customer A blocked│
│  │ Order #3 | Customer A | $20  ✅      │ ← Customer A sees │
│  └──────────────────────────────────────┘                   │
│                                                               │
│  ┌──────────────────────────────────────┐                   │
│  │      CUSTOMER_ACCOUNTS TABLE          │                   │
│  │  RLS: user_id = auth.uid()           │                   │
│  ├──────────────────────────────────────┤                   │
│  │ Account A | user_id_A | ...  ✅      │ ← Customer A sees │
│  │ Account B | user_id_B | ...  ❌      │ ← Customer A blocked│
│  └──────────────────────────────────────┘                   │
│                                                               │
│  ┌──────────────────────────────────────┐                   │
│  │      PAYMENT_TRANSACTIONS TABLE       │                   │
│  │  RLS: customer_id = auth.uid()       │                   │
│  ├──────────────────────────────────────┤                   │
│  │ Payment #1 | Customer A | $50 ✅     │ ← Customer A sees │
│  │ Payment #2 | Customer B | $30 ❌     │ ← Customer A blocked│
│  └──────────────────────────────────────┘                   │
│                                                               │
│                        ▲                                      │
│                        │                                      │
│                 ADMIN USER CAN                               │
│                 SEE ALL DATA                                  │
│          (is_admin() = true bypass)                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## LAYER 2: AUTHENTICATION & USER CLASSIFICATION

```
┌─────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION LAYER                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│         USER LOGS IN                                          │
│              ▼                                                │
│    ┌──────────────────┐                                      │
│    │  Check Profiles  │                                      │
│    │      Table       │                                      │
│    └────────┬─────────┘                                      │
│             │                                                 │
│          Found?                                               │
│         ┌───┴────┐                                           │
│         │        │                                            │
│        YES      NO                                            │
│         │        │                                            │
│         ▼        ▼                                            │
│   ┌─────────┐  ┌──────────────────┐                         │
│   │  ADMIN  │  │ Check Customer   │                         │
│   │  USER   │  │   Accounts Table │                         │
│   └─────────┘  └────────┬─────────┘                         │
│                          │                                    │
│                       Found?                                  │
│                     ┌───┴────┐                               │
│                     │        │                                │
│                    YES      NO                                │
│                     │        │                                │
│                     ▼        ▼                                │
│               ┌──────────┐ ┌──────────────┐                 │
│               │CUSTOMER  │ │ Create New   │                 │
│               │  USER    │ │   Account    │                 │
│               └──────────┘ └──────────────┘                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         USER TYPE DETERMINATION                      │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ • Profile exists → ADMIN USER                       │    │
│  │ • Customer account exists → CUSTOMER USER           │    │
│  │ • Email contains 'admin' → Create ADMIN             │    │
│  │ • toolbuxdev@gmail.com → Create SUPER ADMIN         │    │
│  │ • Google OAuth → Create CUSTOMER (forced)           │    │
│  │ • Default → Create CUSTOMER                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## LAYER 3: UI ROUTE GUARDS

```
┌─────────────────────────────────────────────────────────────┐
│                      UI LAYER (React)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  USER NAVIGATES TO URL                                        │
│           ▼                                                   │
│  ┌──────────────────┐                                        │
│  │ AdminRouteGuard  │                                        │
│  │  or              │                                        │
│  │ CustomerRoute    │                                        │
│  │    Guard         │                                        │
│  └────────┬─────────┘                                        │
│           │                                                   │
│  ┌────────▼─────────┐                                        │
│  │ Check User Type  │                                        │
│  └────────┬─────────┘                                        │
│           │                                                   │
│     ┌─────┴──────┐                                           │
│     │            │                                            │
│  ADMIN        CUSTOMER                                        │
│     │            │                                            │
│     ▼            ▼                                            │
│                                                               │
│  ADMIN ROUTES         CUSTOMER ROUTES                        │
│  ✅ /dashboard        ✅ /                                   │
│  ✅ /admin/orders     ✅ /cart                               │
│  ✅ /customers        ✅ /products                           │
│  ✅ /settings         ✅ /customer/portal                    │
│  ❌ /customer/*       ❌ /admin/*                            │
│                       ❌ /dashboard                           │
│                       ❌ /settings                            │
│                                                               │
│  ┌──────────────────────────────────────┐                   │
│  │   SIDEBAR MENU FILTERING              │                   │
│  ├──────────────────────────────────────┤                   │
│  │ • Each menu item has permission key  │                   │
│  │ • useRoleBasedPermissions() checks   │                   │
│  │ • User sees only authorized items    │                   │
│  │ • Dynamically filtered on render     │                   │
│  └──────────────────────────────────────┘                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## COMPLETE SECURITY FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                  END-TO-END SECURITY FLOW                     │
└─────────────────────────────────────────────────────────────┘

1. USER LOGIN
   ↓
   ┌──────────────────────────┐
   │ Supabase Authentication  │
   └────────────┬─────────────┘
                ↓
   ┌──────────────────────────┐
   │  User Type Detection     │
   │  (Admin vs Customer)     │
   └────────────┬─────────────┘
                ↓
   ┌──────────────────────────┐
   │  Set Session State       │
   │  - user object           │
   │  - customerAccount       │
   │  - userType              │
   └────────────┬─────────────┘
                ↓

2. NAVIGATE TO PAGE
   ↓
   ┌──────────────────────────┐
   │  Route Guard Check       │
   │  - isAuthenticated?      │
   │  - correct userType?     │
   │  - required role?        │
   └────────────┬─────────────┘
                ↓
           ┌────┴────┐
           │         │
        PASS       FAIL
           │         │
           ↓         ↓
      RENDER      REDIRECT
      PAGE         TO AUTH

3. RENDER UI
   ↓
   ┌──────────────────────────┐
   │  Sidebar Menu Filter     │
   │  - Check permissions     │
   │  - Show only authorized  │
   └────────────┬─────────────┘
                ↓

4. DATA ACCESS
   ↓
   ┌──────────────────────────┐
   │  API Request to Supabase │
   └────────────┬─────────────┘
                ↓
   ┌──────────────────────────┐
   │  RLS Policy Check        │
   │  - Check auth.uid()      │
   │  - Check is_admin()      │
   │  - Filter rows           │
   └────────────┬─────────────┘
                ↓
           ┌────┴────┐
           │         │
      AUTHORIZED  DENIED
           │         │
           ↓         ↓
      RETURN     RETURN
      DATA       EMPTY

5. AUDIT LOG
   ↓
   ┌──────────────────────────┐
   │  Log Access Attempt      │
   │  - user_id               │
   │  - action                │
   │  - timestamp             │
   │  - result                │
   └──────────────────────────┘
```

---

## SECURITY CONTROLS MATRIX

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    WHO CAN ACCESS WHAT                      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                              ┃
┃  DATA TYPE          │ CUSTOMER │ ADMIN │ SUPER_ADMIN        ┃
┃  ─────────────────────────────────────────────────────      ┃
┃  Own Orders         │    ✅    │  ✅   │     ✅             ┃
┃  Other Orders       │    ❌    │  ✅   │     ✅             ┃
┃  Own Account        │    ✅    │  ✅   │     ✅             ┃
┃  Other Accounts     │    ❌    │  ✅   │     ✅             ┃
┃  Own Payments       │    ✅    │  ✅   │     ✅             ┃
┃  Other Payments     │    ❌    │  ✅   │     ✅             ┃
┃  Customer List      │    ❌    │  ✅   │     ✅             ┃
┃  User Roles         │  Own Only│ View  │  Manage            ┃
┃  User Permissions   │  Own Only│ View  │  Manage            ┃
┃  Settings           │    ❌    │  ✅   │     ✅             ┃
┃  Reports            │    ❌    │  ✅   │     ✅             ┃
┃  Admin Users Mgmt   │    ❌    │  ❌   │     ✅             ┃
┃                                                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## CRITICAL SECURITY FIXES APPLIED

```
┌─────────────────────────────────────────────────────────────┐
│                  BEFORE FIX (VULNERABLE)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  USER TRIES TO CHECK OWN ROLE                                │
│              ▼                                                │
│  ┌──────────────────────────┐                               │
│  │ SELECT * FROM user_roles │                               │
│  │ WHERE user_id = auth.uid()│                               │
│  └────────────┬─────────────┘                               │
│               ▼                                               │
│  ┌──────────────────────────┐                               │
│  │    RLS POLICY CHECK      │                               │
│  │    (No self-read policy) │                               │
│  └────────────┬─────────────┘                               │
│               ▼                                               │
│         ❌ DENIED                                            │
│  "Permission denied for table user_roles"                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   AFTER FIX (SECURE)                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  USER TRIES TO CHECK OWN ROLE                                │
│              ▼                                                │
│  ┌──────────────────────────┐                               │
│  │ SELECT * FROM user_roles │                               │
│  │ WHERE user_id = auth.uid()│                               │
│  └────────────┬─────────────┘                               │
│               ▼                                               │
│  ┌──────────────────────────┐                               │
│  │    RLS POLICY CHECK      │                               │
│  │  ✅ Self-read policy     │                               │
│  │  user_id = auth.uid()    │                               │
│  └────────────┬─────────────┘                               │
│               ▼                                               │
│         ✅ ALLOWED                                           │
│  Returns: [{role: 'admin', is_active: true, ...}]           │
│                                                               │
│  ┌──────────────────────────┐                               │
│  │   is_admin() Function    │                               │
│  │   NOW WORKS CORRECTLY    │                               │
│  └──────────────────────────┘                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## DEFENSE IN DEPTH STRATEGY

```
┌─────────────────────────────────────────────────────────────┐
│              MULTIPLE SECURITY LAYERS                         │
└─────────────────────────────────────────────────────────────┘

       ATTACKER
           │
           ▼
    ┌──────────────┐
    │ LAYER 1: UI  │  ← Route Guards Block Access
    │ ROUTE GUARDS │     ❌ Redirect if wrong user type
    └──────┬───────┘
           │ Bypassed?
           ▼
    ┌──────────────┐
    │ LAYER 2: API │  ← API Endpoints Check Auth
    │ AUTHENTICATION│    ❌ Return 401 if not authenticated
    └──────┬───────┘
           │ Bypassed?
           ▼
    ┌──────────────┐
    │ LAYER 3: RLS │  ← Database Policies Filter Data
    │ POLICIES     │     ❌ Return empty set if unauthorized
    └──────┬───────┘
           │ Bypassed?
           ▼
    ┌──────────────┐
    │ LAYER 4:     │  ← All Access Logged
    │ AUDIT LOGS   │     🔍 Suspicious activity detected
    └──────────────┘

    🛡️ MULTIPLE BARRIERS = STRONG SECURITY
```

---

## KEY SECURITY PRINCIPLES

```
┌─────────────────────────────────────────────────────────────┐
│          SECURITY DESIGN PRINCIPLES APPLIED                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. PRINCIPLE OF LEAST PRIVILEGE                             │
│     • Users get minimum permissions needed                   │
│     • Default deny, explicit allow                           │
│                                                               │
│  2. DEFENSE IN DEPTH                                         │
│     • Multiple security layers                               │
│     • UI guards + API auth + RLS policies                    │
│                                                               │
│  3. FAIL SECURE                                              │
│     • On error, deny access (don't allow)                    │
│     • Missing policy = no access                             │
│                                                               │
│  4. SEPARATION OF DUTIES                                     │
│     • Admin users separate from customers                    │
│     • Different roles, different permissions                 │
│                                                               │
│  5. AUDIT TRAIL                                              │
│     • All actions logged                                     │
│     • Who, what, when, result                                │
│                                                               │
│  6. PRIVACY BY DESIGN                                        │
│     • Customer data isolated by default                      │
│     • Cannot access other customers' data                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

**END OF SECURITY ARCHITECTURE DIAGRAM**

For implementation details, see:
- PRODUCTION_SECURITY_AUDIT_DEEP.md
- SECURITY_AUDIT_QUICK_REFERENCE.md
- SECURITY_AUDIT_EXECUTIVE_SUMMARY.md
