#!/bin/bash

# =============================================================================
# DATABASE BACKUP SCRIPT FOR TRAVEL API
# =============================================================================
# Script ini backup database PostgreSQL (lokal atau Railway)
# Usage: ./backup_database.sh [local|railway|both]
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)/db_backups"
mkdir -p "$BACKUP_DIR"

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

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    print_error ".env file not found!"
    exit 1
fi

backup_local_db() {
    print_info "Backing up local database..."
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
        print_error "Local database credentials not found in .env"
        return 1
    fi
    
    local backup_file="$BACKUP_DIR/local_db_backup_${TIMESTAMP}.sql"
    
    # Try to backup using pg_dump
    if command -v pg_dump &> /dev/null; then
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --clean \
            --if-exists \
            > "$backup_file" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            local size=$(du -sh "$backup_file" | cut -f1)
            print_success "Local DB backed up: $backup_file ($size)"
            
            # Compress backup
            gzip "$backup_file"
            print_success "Compressed to: ${backup_file}.gz"
        else
            print_error "Local database backup failed"
            return 1
        fi
    else
        print_error "pg_dump not installed. Install PostgreSQL client tools."
        print_info "macOS: brew install postgresql"
        return 1
    fi
}

backup_railway_db() {
    print_info "Backing up Railway database..."
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not found in .env"
        return 1
    fi
    
    local backup_file="$BACKUP_DIR/railway_db_backup_${TIMESTAMP}.sql"
    
    # Try to backup using pg_dump with DATABASE_URL
    if command -v pg_dump &> /dev/null; then
        pg_dump "$DATABASE_URL" \
            --clean \
            --if-exists \
            > "$backup_file" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            local size=$(du -sh "$backup_file" | cut -f1)
            print_success "Railway DB backed up: $backup_file ($size)"
            
            # Compress backup
            gzip "$backup_file"
            print_success "Compressed to: ${backup_file}.gz"
        else
            print_error "Railway database backup failed"
            return 1
        fi
    else
        print_error "pg_dump not installed. Install PostgreSQL client tools."
        print_info "macOS: brew install postgresql"
        return 1
    fi
}

cleanup_old_backups() {
    print_info "Cleaning up old backups (keeping last 10)..."
    
    cd "$BACKUP_DIR"
    ls -t *.sql.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
    
    local count=$(ls -1 *.sql.gz 2>/dev/null | wc -l)
    print_success "Current backups: $count"
}

restore_info() {
    echo ""
    print_header "HOW TO RESTORE"
    echo "To restore a backup:"
    echo ""
    echo "1. Uncompress the backup:"
    echo "   gunzip db_backups/backup_file.sql.gz"
    echo ""
    echo "2. Restore to local database:"
    echo "   PGPASSWORD=\$DB_PASSWORD psql -h \$DB_HOST -U \$DB_USER -d \$DB_NAME < backup_file.sql"
    echo ""
    echo "3. Restore to Railway:"
    echo "   psql \$DATABASE_URL < backup_file.sql"
    echo ""
}

# =============================================================================
# MAIN
# =============================================================================

print_header "DATABASE BACKUP SCRIPT"
echo "Timestamp: $TIMESTAMP"
echo "Backup directory: $BACKUP_DIR"
echo ""

MODE="${1:-both}"

case $MODE in
    local)
        backup_local_db
        ;;
    railway)
        backup_railway_db
        ;;
    both)
        backup_local_db || true
        echo ""
        backup_railway_db || true
        ;;
    *)
        print_error "Invalid mode: $MODE"
        echo "Usage: $0 [local|railway|both]"
        exit 1
        ;;
esac

echo ""
cleanup_old_backups
restore_info

print_header "BACKUP COMPLETE"
