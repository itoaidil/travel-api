# 🔐 Backup & Version Control Guide

Panduan lengkap untuk backup dan version control project Travel API.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Backup Scripts](#backup-scripts)
- [Git Version Control](#git-version-control)
- [Restore Procedures](#restore-procedures)
- [Best Practices](#best-practices)

---

## 🚀 Quick Start

### 1. Setup Git (One Time)

```bash
# Inisialisasi Git repository
git init

# Tambahkan semua file
git add .

# Commit pertama
git commit -m "Initial commit: Travel API project"

# (Optional) Push ke GitHub
git remote add origin https://github.com/username/travel-api.git
git branch -M main
git push -u origin main
```

### 2. Run Backup

```bash
# Backup full project
./backup.sh

# Backup database saja
./backup_database.sh
```

---

## 💾 Backup Scripts

### `backup.sh` - Full Project Backup

Backup lengkap project ke multiple locations.

**Features:**
- ✅ Backup ke local, SSD external, dan cloud storage
- ✅ Automatic timestamp
- ✅ Exclude node_modules dan file besar
- ✅ Keep 5 backup terbaru
- ✅ Database backup otomatis

**Usage:**

```bash
./backup.sh
```

**Customize Backup Locations:**

Edit file `backup.sh` baris 20-22:

```bash
SSD_BACKUP="/Volumes/YourSSDName/Backups"
CLOUD_BACKUP="$HOME/Library/CloudStorage/GoogleDrive-YourEmail/Backups"
LOCAL_BACKUP="$HOME/Backups/${PROJECT_NAME}"
```

**What Gets Backed Up:**
- ✅ Source code (.js, .sql, config files)
- ✅ Documentation (.md files)
- ✅ Database schema (migrations)
- ✅ Environment template
- ❌ node_modules (excluded)
- ❌ .git folder (excluded)
- ❌ Log files (excluded)

---

### `backup_database.sh` - Database Only Backup

Backup database PostgreSQL (local atau Railway).

**Usage:**

```bash
# Backup both local and Railway DB
./backup_database.sh both

# Backup local DB only
./backup_database.sh local

# Backup Railway DB only
./backup_database.sh railway
```

**Requirements:**
- PostgreSQL client tools installed: `brew install postgresql`
- `.env` file with database credentials

**Output:**
- Compressed SQL dumps in `db_backups/` folder
- Keeps 10 most recent backups
- Format: `local_db_backup_YYYYMMDD_HHMMSS.sql.gz`

---

## 🔄 Git Version Control

### Daily Workflow

```bash
# Check status
git status

# Add modified files
git add .

# Commit changes
git commit -m "feat: add new booking feature"

# Push to remote
git push
```

### Commit Message Convention

```bash
# Feature
git commit -m "feat: add payment integration"

# Bug fix
git commit -m "fix: resolve booking seat conflict"

# Documentation
git commit -m "docs: update API documentation"

# Refactor
git commit -m "refactor: optimize database queries"

# Style
git commit -m "style: format code with prettier"
```

### Branching Strategy

```bash
# Create feature branch
git checkout -b feature/midtrans-payment

# Work on feature
git add .
git commit -m "feat: implement Midtrans SDK"

# Merge back to main
git checkout main
git merge feature/midtrans-payment

# Delete feature branch
git branch -d feature/midtrans-payment
```

### View History

```bash
# View commit history
git log --oneline

# View changes in specific file
git log -p server.js

# View who changed what
git blame server.js
```

---

## 🔧 Restore Procedures

### Restore from Project Backup

```bash
# 1. Navigate to backup location
cd /path/to/backups

# 2. List available backups
ls -lt

# 3. Copy backup to desired location
cp -R travel_api_backup_20250122_143000 /path/to/restore

# 4. Navigate to restored folder
cd /path/to/restore

# 5. Install dependencies
npm install

# 6. Setup environment
cp .env.example .env
# Edit .env with your credentials

# 7. Run migrations
npm run migrate

# 8. Start server
npm start
```

### Restore Database from Backup

```bash
# 1. Navigate to db_backups folder
cd db_backups

# 2. List available backups
ls -lt

# 3. Decompress backup
gunzip local_db_backup_20250122_143000.sql.gz

# 4. Restore to local database
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME < local_db_backup_20250122_143000.sql

# 5. Or restore to Railway
psql $DATABASE_URL < railway_db_backup_20250122_143000.sql
```

### Restore from Git

```bash
# Revert last commit
git revert HEAD

# Revert to specific commit
git revert abc1234

# Reset to specific commit (DANGEROUS - loses changes)
git reset --hard abc1234

# Create new branch from old commit
git checkout -b recovery abc1234
```

---

## ✅ Best Practices

### 3-2-1 Backup Rule

- **3** copies of data
- **2** different storage media
- **1** offsite backup

**Implementation:**
1. **Local backup** → `~/Backups/`
2. **SSD external** → `/Volumes/YourSSD/Backups/`
3. **Cloud/GitHub** → Google Drive + GitHub repository

---

### Backup Schedule

| Frequency | Action | Method |
|-----------|--------|--------|
| **Setiap coding session** | Git commit | `git commit -m "message"` |
| **Setiap hari** | Push to GitHub | `git push` |
| **Setiap minggu** | Full backup | `./backup.sh` |
| **Setiap update penting** | Database backup | `./backup_database.sh` |
| **Sebelum deploy** | Full backup + DB | Both scripts |

---

### Security Checklist

- [ ] `.env` file TIDAK di-commit ke Git
- [ ] Credentials files di `.gitignore`
- [ ] GitHub repository set sebagai PRIVATE
- [ ] Database backups ter-encrypt (gunakan `gpg`)
- [ ] SSD external pakai password/encryption
- [ ] Cloud storage pakai 2FA

---

### Automation Tips

#### Auto Backup dengan Cron (macOS)

```bash
# Edit crontab
crontab -e

# Add this line (backup every day at 2 AM)
0 2 * * * cd /path/to/project && ./backup.sh >> backup.log 2>&1

# Backup database every 6 hours
0 */6 * * * cd /path/to/project && ./backup_database.sh both >> db_backup.log 2>&1
```

#### Create Alias untuk Quick Backup

Add to `~/.zshrc`:

```bash
alias travel-backup="cd /path/to/travel_api && ./backup.sh"
alias travel-db-backup="cd /path/to/travel_api && ./backup_database.sh both"
alias travel-commit="cd /path/to/travel_api && git add . && git commit -m"
```

Reload:
```bash
source ~/.zshrc
```

Usage:
```bash
travel-backup
travel-db-backup
travel-commit "fix: booking bug"
```

---

## 🆘 Troubleshooting

### "pg_dump: command not found"

Install PostgreSQL client tools:
```bash
brew install postgresql
```

### "Permission denied" on backup scripts

Make scripts executable:
```bash
chmod +x backup.sh backup_database.sh
```

### Git push rejected

```bash
# Pull latest changes first
git pull origin main --rebase

# Then push
git push origin main
```

### Large files error on Git

Add large files to `.gitignore`:
```bash
echo "large_file.zip" >> .gitignore
git rm --cached large_file.zip
git commit -m "remove large file"
```

---

## 📞 Emergency Recovery

Jika project corrupt atau hilang:

1. **Check Git history** → `git reflog`
2. **Restore from latest backup** → Check `~/Backups/travel_api/latest/`
3. **Restore from SSD** → Check external SSD backup
4. **Clone from GitHub** → `git clone <repo-url>`
5. **Restore database** → Use latest `.sql.gz` from `db_backups/`

---

## 📚 Additional Resources

- [Git Documentation](https://git-scm.com/doc)
- [PostgreSQL Backup Guide](https://www.postgresql.org/docs/current/backup.html)
- [GitHub Best Practices](https://github.com/github/platform-samples)

---

**Created:** November 22, 2025  
**Last Updated:** November 22, 2025  
**Version:** 1.0
