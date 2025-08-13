#!/bin/bash
# STRIPE ELIMINATION VERIFICATION SCRIPT
# ======================================
# Ensures no Stripe references remain in the codebase

echo "🔍 Checking for Stripe references in codebase..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Exit code
EXIT_CODE=0

# Directories to check
SEARCH_DIRS="src/ supabase/ *.ts *.tsx *.js *.jsx *.json *.md *.yml *.yaml"

# Patterns to search for
STRIPE_PATTERNS=(
    "stripe"
    "STRIPE_"
    "api.stripe.com"
    "js.stripe.com"
    "stripe.com"
    "sk_test_"
    "sk_live_"
    "pk_test_"
    "pk_live_"
    "stripeProp"
    "stripeKey"
    "StripeJS"
)

PAY_PATTERNS=(
    "pay_[0-9]"
    "generateReference"
    "frontend.*reference"
)

echo "Checking for Stripe patterns..."

for pattern in "${STRIPE_PATTERNS[@]}"; do
    echo "  Searching for: $pattern"
    
    # Search for pattern (case insensitive)
    MATCHES=$(grep -r -i --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" --include="*.md" --exclude-dir=node_modules --exclude-dir=.git "$pattern" . 2>/dev/null)
    
    if [ ! -z "$MATCHES" ]; then
        echo -e "${RED}❌ Found Stripe reference: $pattern${NC}"
        echo "$MATCHES"
        echo ""
        EXIT_CODE=1
    fi
done

echo "Checking for legacy pay_ reference patterns..."

for pattern in "${PAY_PATTERNS[@]}"; do
    echo "  Searching for: $pattern"
    
    MATCHES=$(grep -r -E --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=.git "$pattern" . 2>/dev/null)
    
    if [ ! -z "$MATCHES" ]; then
        echo -e "${YELLOW}⚠️  Found legacy reference pattern: $pattern${NC}"
        echo "$MATCHES"
        echo ""
        # Don't fail for legacy patterns - just warn
    fi
done

# Check package.json specifically
echo "Checking package.json for Stripe dependencies..."
if [ -f "package.json" ]; then
    STRIPE_DEPS=$(grep -i "stripe" package.json 2>/dev/null)
    if [ ! -z "$STRIPE_DEPS" ]; then
        echo -e "${RED}❌ Found Stripe dependencies in package.json:${NC}"
        echo "$STRIPE_DEPS"
        EXIT_CODE=1
    fi
fi

# Check environment files
echo "Checking for Stripe environment variables..."
ENV_FILES=(".env" ".env.local" ".env.example" ".env.production")

for env_file in "${ENV_FILES[@]}"; do
    if [ -f "$env_file" ]; then
        STRIPE_VARS=$(grep -i "STRIPE_" "$env_file" 2>/dev/null)
        if [ ! -z "$STRIPE_VARS" ]; then
            echo -e "${RED}❌ Found Stripe environment variables in $env_file:${NC}"
            echo "$STRIPE_VARS"
            EXIT_CODE=1
        fi
    fi
done

# Final result
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ No Stripe references found! Codebase is clean.${NC}"
else
    echo -e "${RED}❌ Stripe references detected! Please remove them before proceeding.${NC}"
fi

exit $EXIT_CODE