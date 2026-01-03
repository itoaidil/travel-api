# 💾 SSD Migration & Setup Instructions

## ✅ Setup Selesai!

Saya sudah membuat complete backup & version control system untuk kedua project Anda:

### 📁 Files Created

**Kedua project (`travel_api` & `travel-api-main 2`):**
- ✅ `backup.sh` - Auto backup project ke multiple locations
- ✅ `backup_database.sh` - Database backup script
- ✅ `.gitignore` - Updated (exclude node_modules, .env, credentials)
- ✅ `BACKUP_GUIDE.md` - Comprehensive documentation
- ✅ `QUICK_REFERENCE.md` - Quick command reference
- ✅ Git initialized dengan commit history

---

## 🚀 Next Steps: Migration ke SSD

### Step 1: Check SSD Name

```bash
ls /Volumes
```

Output example: `Macintosh HD`, `YourSSDName`

### Step 2: Copy Project ke SSD

```bash
# Ganti "YourSSDName" dengan nama SSD Anda
cp -R "/Users/fitroaidil/Downloads/drive-download-20251121T145750Z-1-001/travel_api" /Volumes/YourSSDName/

cp -R "/Users/fitroaidil/Downloads/travel-api-main 2" /Volumes/YourSSDName/
```

### Step 3: Navigate & Setup

```bash
# Navigate ke project di SSD
cd /Volumes/YourSSDName/travel_api

# Install dependencies
npm install

# Setup environment
cp .env.example .env
nano .env  # atau: code .env

# Run project
npm start
```

### Step 4: Open di VS Code

```bash
cd /Volumes/YourSSDName/travel_api
code .
```

---

## 💾 Backup Strategy (3-2-1 Rule)

### 1️⃣ Primary: Git + GitHub (RECOMMENDED)

**Setup GitHub Remote:**

```bash
# 1. Create new PRIVATE repo on GitHub
#    Go to: https://github.com/new
#    Name: travel-api
#    ✅ Private
#    ❌ Don't initialize with README

# 2. Add remote & push
cd /Volumes/YourSSDName/travel_api
git remote add origin https://github.com/YOUR_USERNAME/travel-api.git
git push -u origin main
```

**Daily workflow:**
```bash
git add .
git commit -m "feat: your changes"
git push
```

### 2️⃣ Secondary: Automated Local + SSD Backup

**Run backup script (recommended weekly):**

```bash
cd /Volumes/YourSSDName/travel_api
./backup.sh
```

**What it does:**
- ✅ Backup ke `~/Backups/travel_api/` (Mac internal)
- ✅ Backup ke SSD external (if mounted)
- ✅ Backup ke cloud storage (if configured)
- ✅ Keep 5 most recent backups
- ✅ Auto compress & timestamp

**Customize backup locations:**

Edit `backup.sh` lines 20-22:
```bash
SSD_BACKUP="/Volumes/YourSSDName/Backups"
CLOUD_BACKUP="$HOME/Library/CloudStorage/GoogleDrive-YourEmail/Backups"
LOCAL_BACKUP="$HOME/Backups/${PROJECT_NAME}"
```

### 3️⃣ Tertiary: Database Backups

**Run database backup:**

```bash
cd /Volumes/YourSSDName/travel_api
./backup_database.sh both
```

**Output:** `db_backups/local_db_backup_YYYYMMDD.sql.gz`

---

## 🔐 Security Checklist

Before pushing to GitHub:

- [x] `.gitignore` configured (DONE)
- [ ] Create PRIVATE repository on GitHub
- [ ] Remove any hardcoded credentials from code
- [ ] Verify `.env` is NOT committed: `git status`
- [ ] Check no credentials in git history: `git log -p`

**Verify sensitive files ignored:**
```bash
git status
# Should NOT see:
# - .env
# - PO_LOGIN_CREDENTIALS.md
# - STUDENT_LOGIN_CREDENTIALS.md
# - node_modules/
```

---

## 📅 Recommended Backup Schedule

| When | Action | Command |
|------|--------|---------|
| **Every save** | Auto-save in VS Code | (automatic) |
| **Every feature** | Git commit | `git add . && git commit -m "message"` |
| **End of day** | Git push | `git push` |
| **Before deploy** | Full backup | `./backup.sh` |
| **Weekly** | Full backup + DB | `./backup.sh && ./backup_database.sh both` |
| **Before major changes** | Create branch | `git checkout -b feature/name` |

---

## 🆘 Emergency Recovery

### If SSD fails:
1. Clone from GitHub: `git clone <repo-url>`
2. Or restore from `~/Backups/travel_api/latest/`

### If need to restore database:
```bash
cd db_backups
gunzip backup_file.sql.gz
psql $DATABASE_URL < backup_file.sql
```

### If accidentally deleted files:
```bash
git checkout HEAD -- filename.js
```

---

## ⚡ Automation (Optional)

**Add aliases to `~/.zshrc`:**

```bash
# Add these lines
alias travel-backup="cd /Volumes/YourSSDName/travel_api && ./backup.sh"
alias travel-db="cd /Volumes/YourSSDName/travel_api && ./backup_database.sh both"
alias travel-commit="cd /Volumes/YourSSDName/travel_api && git add . && git commit -m"
alias travel-push="cd /Volumes/YourSSDName/travel_api && git push"
alias travel-code="cd /Volumes/YourSSDName/travel_api && code ."
```

**Reload:**
```bash
source ~/.zshrc
```

**Usage:**
```bash
travel-code          # Open project in VS Code
travel-commit "message"  # Quick commit
travel-push          # Push to GitHub
travel-backup        # Run full backup
travel-db           # Backup database
```

---

## 📊 Benefits of Running from SSD

✅ **Faster read/write** → npm install, file operations
✅ **Better performance** → Server startup, hot reload
✅ **Less wear** on Mac internal storage
✅ **Portable** → Can plug into any Mac
✅ **Separate resources** → Storage & I/O from SSD

**Performance tip:** Format SSD as APFS for best macOS performance

---

## 🎯 Summary

**Setup Status:**
- ✅ Backup scripts created & tested
- ✅ Git initialized with commits
- ✅ .gitignore configured
- ✅ Documentation complete
- 🔲 Copy to SSD (YOU DO THIS)
- 🔲 Setup GitHub remote (RECOMMENDED)

**Next immediate actions:**
1. Copy project ke SSD (Step 2 above)
2. Create GitHub private repo
3. Push to GitHub
4. Test backup script: `./backup.sh`

**Questions?**
- See `BACKUP_GUIDE.md` for full documentation
- See `QUICK_REFERENCE.md` for command cheatsheet

---

**Created:** November 22, 2025  
**Location:**
- Project 1: `drive-download-20251121T145750Z-1-001/travel_api/`
- Project 2: `travel-api-main 2/`
