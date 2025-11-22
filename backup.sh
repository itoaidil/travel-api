#!/bin/bash

# =============================================================================
# TRAVEL API BACKUP AUTOMATION SCRIPT
# =============================================================================
# Script ini akan backup project ke multiple locations dengan timestamp
# Usage: ./backup.sh [destination]
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="travel_api"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="${PROJECT_NAME}_backup_${TIMESTAMP}"

# Source directory (current directory)
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

# Backup destinations (customize these)
SSD_BACKUP="/Volumes/NamaSSD/Backups"  # Change to your SSD mount point
CLOUD_BACKUP="$HOME/Library/CloudStorage/GoogleDrive-YourEmail/Backups"  # Change to your cloud path
LOCAL_BACKUP="$HOME/Backups/${PROJECT_NAME}"

# Files/folders to exclude from backup
EXCLUDE_PATTERNS=(
    "node_modules"
    ".git"
    ".DS_Store"
    "*.log"
    "npm-debug.log*"
    ".env.local"
    ".env.*.local"
    "coverage"
    ".vscode"
    "dist"
    "build"
)

# =============================================================================
# FUNCTIONS
# =============================================================================

print_header() {
    echo -e "${GREEN}=================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}=================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

create_backup() {
    local destination=$1
    local dest_name=$2
    
    # Create destination directory if not exists
    if [ ! -d "$destination" ]; then
        mkdir -p "$destination" 2>/dev/null || {
            print_error "Cannot create directory: $destination (skipping)"
            return 1
        }
    fi
    
    # Check if destination is writable
    if [ ! -w "$destination" ]; then
        print_error "No write permission: $destination (skipping)"
        return 1
    fi
    
    print_info "Backing up to: $destination/$BACKUP_NAME"
    
    # Build rsync exclude parameters
    RSYNC_EXCLUDES=""
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        RSYNC_EXCLUDES="$RSYNC_EXCLUDES --exclude='$pattern'"
    done
    
    # Create backup using rsync
    eval rsync -av --delete $RSYNC_EXCLUDES "$SOURCE_DIR/" "$destination/$BACKUP_NAME/" 2>&1 | tail -n 5
    
    if [ $? -eq 0 ]; then
        print_success "$dest_name backup completed"
        
        # Create a "latest" symlink
        ln -sfn "$BACKUP_NAME" "$destination/latest"
        
        # Show backup size
        local size=$(du -sh "$destination/$BACKUP_NAME" | cut -f1)
        print_info "Backup size: $size"
        
        return 0
    else
        print_error "$dest_name backup failed"
        return 1
    fi
}

cleanup_old_backups() {
    local destination=$1
    local keep_count=5  # Keep last 5 backups
    
    print_info "Cleaning up old backups (keeping last $keep_count)..."
    
    if [ -d "$destination" ]; then
        cd "$destination"
        ls -dt ${PROJECT_NAME}_backup_* 2>/dev/null | tail -n +$((keep_count + 1)) | xargs rm -rf 2>/dev/null
        print_success "Old backups cleaned"
    fi
}

backup_database() {
    print_info "Backing up database..."
    
    # Load environment variables
    if [ -f "$SOURCE_DIR/.env" ]; then
        export $(cat "$SOURCE_DIR/.env" | grep -v '^#' | xargs)
        
        # Create database backups directory
        DB_BACKUP_DIR="$SOURCE_DIR/db_backups"
        mkdir -p "$DB_BACKUP_DIR"
        
        # Backup database (PostgreSQL example)
        if [ ! -z "$DATABASE_URL" ]; then
            PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" > "$DB_BACKUP_DIR/db_backup_${TIMESTAMP}.sql" 2>/dev/null && \
                print_success "Database backed up to db_backups/db_backup_${TIMESTAMP}.sql" || \
                print_error "Database backup failed (pg_dump may not be installed or DB not accessible)"
        else
            print_info "No DATABASE_URL found, skipping database backup"
        fi
    else
        print_info "No .env file found, skipping database backup"
    fi
}

# =============================================================================
# MAIN SCRIPT
# =============================================================================

print_header "TRAVEL API BACKUP SCRIPT"
echo "Timestamp: $TIMESTAMP"
echo "Source: $SOURCE_DIR"
echo ""

# Backup database first
backup_database
echo ""

# Perform backups
print_header "CREATING BACKUPS"

# 1. Local backup (always available)
if create_backup "$LOCAL_BACKUP" "Local"; then
    cleanup_old_backups "$LOCAL_BACKUP"
fi
echo ""

# 2. SSD backup (if available)
if [ -d "/Volumes" ]; then
    # Try to find any mounted external drive
    EXTERNAL_DRIVES=$(ls /Volumes 2>/dev/null | grep -v "Macintosh HD")
    if [ ! -z "$EXTERNAL_DRIVES" ]; then
        FIRST_DRIVE=$(echo "$EXTERNAL_DRIVES" | head -n 1)
        SSD_BACKUP="/Volumes/$FIRST_DRIVE/Backups/${PROJECT_NAME}"
        print_info "Found external drive: $FIRST_DRIVE"
        
        if create_backup "$SSD_BACKUP" "SSD"; then
            cleanup_old_backups "$SSD_BACKUP"
        fi
    else
        print_info "No external SSD found (skipping SSD backup)"
    fi
else
    print_info "No external SSD found (skipping SSD backup)"
fi
echo ""

# 3. Cloud backup (if available)
if [ -d "$CLOUD_BACKUP" ]; then
    if create_backup "$CLOUD_BACKUP/${PROJECT_NAME}" "Cloud"; then
        cleanup_old_backups "$CLOUD_BACKUP/${PROJECT_NAME}"
    fi
else
    print_info "Cloud backup path not found (skipping cloud backup)"
    print_info "Configure cloud path in script: CLOUD_BACKUP variable"
fi
echo ""

# Summary
print_header "BACKUP SUMMARY"
print_success "Backup completed successfully!"
print_info "Backup name: $BACKUP_NAME"
print_info "You can restore by copying the backup folder to your desired location"
echo ""
print_info "To customize backup locations, edit this script and update:"
print_info "  - SSD_BACKUP (line 20)"
print_info "  - CLOUD_BACKUP (line 21)"
print_info "  - LOCAL_BACKUP (line 22)"
