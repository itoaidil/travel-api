# 🚀 Quick Reference - Backup & Git Commands

## 📦 Backup Commands

```bash
# Full project backup (recommended sebelum deploy)
./backup.sh

# Database backup saja
./backup_database.sh both

# Database backup (local only)
./backup_database.sh local

# Database backup (Railway only)
./backup_database.sh railway
```

## 📝 Git Commands (Daily Use)

```bash
# Check status
git status

# Add & commit
git add .
git commit -m "feat: your message here"

# Push to GitHub
git push

# View history
git log --oneline
```

## 💾 Copy ke SSD External

```bash
# 1. Check SSD name
ls /Volumes

# 2. Copy project ke SSD
cp -R ~/Downloads/travel_api /Volumes/YourSSDName/

# 3. Open project dari SSD
cd /Volumes/YourSSDName/travel_api
code .

# 4. Install dependencies
npm install

# 5. Setup .env
cp .env.example .env
# Edit .env dengan credentials

# 6. Run project
npm start
```

## 🔄 Restore from Backup

```bash
# List backups
ls -lt ~/Backups/travel_api/

# Restore from backup
cp -R ~/Backups/travel_api/latest ~/Desktop/travel_api_restored

# Restore database
cd db_backups
gunzip backup_file.sql.gz
psql $DATABASE_URL < backup_file.sql
```

## 🔐 Setup GitHub Remote

```bash
# 1. Create new repo on GitHub (browser)

# 2. Add remote
git remote add origin https://github.com/username/travel-api.git

# 3. Push
git branch -M main
git push -u origin main
```

## ⚡ Automation Setup

```bash
# Add to ~/.zshrc
echo 'alias travel-backup="cd ~/path/to/travel_api && ./backup.sh"' >> ~/.zshrc
echo 'alias travel-db="cd ~/path/to/travel_api && ./backup_database.sh both"' >> ~/.zshrc

# Reload
source ~/.zshrc

# Use
travel-backup
travel-db
```

## 🆘 Emergency Commands

```bash
# Revert last commit
git revert HEAD

# Discard all local changes
git reset --hard HEAD

# Recover deleted file
git checkout HEAD -- filename.js

# View deleted files
git log --diff-filter=D --summary
```

---

📚 **Full Documentation:** See `BACKUP_GUIDE.md`
