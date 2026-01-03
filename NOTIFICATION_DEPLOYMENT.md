# 🚀 Quick Deployment Guide - Notification System

## Langkah-Langkah Deploy ke Railway

### 1. Run Migration di Railway

```bash
# Via Railway CLI (jika sudah install)
railway run node migrations/create_notifications_tables.js

# Atau via Railway Dashboard
# Go to: Your Project → Deployments → Shell
# Run: node migrations/create_notifications_tables.js
```

### 2. Setup Firebase di Railway Environment Variables

Go to Railway Dashboard → Your Project → Variables

Tambahkan:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour-Key-Here\n-----END PRIVATE KEY-----\n
```

**Cara dapat credentials:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Pilih/buat project Anda
3. Project Settings → Service Accounts
4. Generate New Private Key → Download JSON
5. Copy values dari JSON ke Railway variables

### 3. Deploy & Test

```bash
# Push ke Railway (auto-deploy)
git push

# Test notification endpoints
curl https://your-railway-url.up.railway.app/api/notifications/test \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId": 1}'
```

### 4. Verify Tables Created

```bash
# Via Railway Shell
railway run node -e "const db = require('./config/database'); db.query('SHOW TABLES').then(console.log)"
```

## Testing Checklist

- [ ] Migration creates 3 tables (device_tokens, notifications, notification_settings)
- [ ] Notification routes accessible (`/api/notifications/*`)
- [ ] Test register-token endpoint
- [ ] Test send notification
- [ ] Create booking → Auto-send notifications to PO, Driver, Customer

## Notification Flow Test

1. **Customer** creates booking via app
2. Check Railway logs for:
   ```
   ✅ Notification sent to PO (user X)
   ✅ Notification sent to Driver (user Y)
   ✅ Notification sent to Customer (user Z)
   ```
3. **PO App** receives: "📋 Booking Baru!"
4. **Driver App** receives: "🚗 Perjalanan Baru!"
5. **Customer App** receives: "✅ Booking Berhasil!"

## Troubleshooting

**Error: Firebase not configured**
- Check Railway environment variables
- Verify FIREBASE_PRIVATE_KEY has proper `\n` escaping

**Error: Tables don't exist**
- Run migration: `railway run node migrations/create_notifications_tables.js`
- Check Railway logs for migration errors

**No notifications received**
- Check device token registered: `SELECT * FROM device_tokens`
- Check notifications created: `SELECT * FROM notifications ORDER BY created_at DESC`
- Verify Firebase Cloud Messaging enabled in Firebase Console
- Check Railway logs for FCM errors

## Next Steps

After backend deployed:
1. Setup Flutter apps dengan Firebase
2. Add `google-services.json` ke Android projects
3. Implement `NotificationService` di Flutter
4. Register FCM token after login
5. Build & test on physical device (FCM tidak reliable di emulator)

---

**Status:** Backend ready ✅  
**Last Updated:** December 7, 2025
