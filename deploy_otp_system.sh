#!/bin/bash

# OTP System Deployment Script
# This script helps deploy the OTP email verification system to Railway

echo ""
echo "🚀 OTP Email Verification System - Deployment Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to print colored output
print_success() {
    echo "✅ $1"
}

print_error() {
    echo "❌ $1"
}

print_info() {
    echo "ℹ️  $1"
}

print_warning() {
    echo "⚠️  $1"
}

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    print_error "server.js not found. Please run this script from travel_api directory."
    exit 1
fi

print_success "Found travel_api directory"

# Check if nodemailer is installed
if grep -q "nodemailer" package.json; then
    print_success "nodemailer dependency found in package.json"
else
    print_error "nodemailer not found in package.json"
    exit 1
fi

# Check if all required files exist
echo ""
echo "📋 Checking required files..."
FILES=(
    "services/emailService.js"
    "routes/otpRoutes.js"
    "migrations/create_otp_table.sql"
    "test_otp_system.js"
    "OTP_SYSTEM_DOCUMENTATION.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file"
    else
        print_error "$file not found!"
        exit 1
    fi
done

# Check git status
echo ""
echo "📦 Checking git status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    print_success "Git repository found"
    
    # Show uncommitted changes
    if [[ -n $(git status -s) ]]; then
        echo ""
        print_info "Uncommitted changes found:"
        git status -s
    else
        print_success "Working directory clean"
    fi
else
    print_error "Not a git repository"
    exit 1
fi

# Test OTP system locally
echo ""
echo "🧪 Testing OTP system locally..."
if node test_otp_system.js > /dev/null 2>&1; then
    print_success "OTP system test passed"
else
    print_error "OTP system test failed. Please check the error above."
    exit 1
fi

# Prompt for deployment
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Pre-deployment Checklist:"
echo ""
echo "Before deploying, make sure you have:"
echo "  [ ] Run database migration on Railway MySQL"
echo "  [ ] Set EMAIL_MODE=testing in Railway variables"
echo "  [ ] (Optional) Set EMAIL_USER and EMAIL_APP_PASSWORD for production"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Have you completed the checklist above? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    print_warning "Deployment cancelled"
    echo ""
    print_info "Next steps:"
    echo "  1. Run database migration: see OTP_SYSTEM_DOCUMENTATION.md"
    echo "  2. Set environment variables in Railway Dashboard"
    echo "  3. Run this script again"
    echo ""
    exit 0
fi

# Git add, commit, and push
echo ""
echo "📤 Deploying to Railway..."
echo ""

# Stage changes
git add .
print_success "Staged changes"

# Commit
echo ""
read -p "Enter commit message (default: 'Add OTP email verification system'): " commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="Add OTP email verification system"
fi

git commit -m "$commit_msg"
print_success "Committed changes"

# Push to Railway
echo ""
print_info "Pushing to Railway..."
if git push origin main; then
    print_success "Successfully pushed to Railway!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 Deployment initiated!"
    echo ""
    echo "📊 Monitor deployment:"
    echo "   railway logs --follow"
    echo ""
    echo "🧪 Test endpoints:"
    echo "   POST https://travel-api-production-23ae.up.railway.app/api/auth/register"
    echo "   POST https://travel-api-production-23ae.up.railway.app/api/auth/verify-otp"
    echo "   POST https://travel-api-production-23ae.up.railway.app/api/auth/resend-otp"
    echo ""
    echo "📖 Documentation:"
    echo "   See OTP_SYSTEM_DOCUMENTATION.md for testing guide"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
else
    print_error "Failed to push to Railway"
    echo ""
    print_info "Troubleshooting:"
    echo "  1. Check if you have push access to the repository"
    echo "  2. Verify remote is set correctly: git remote -v"
    echo "  3. Try manually: git push origin main"
    echo ""
    exit 1
fi
