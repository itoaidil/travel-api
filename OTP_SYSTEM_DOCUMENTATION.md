# OTP Email Verification System

## Overview
Email-based OTP (One-Time Password) verification system for customer registration in PO Hantar Travel app.

## Features
- ✅ 6-digit OTP code
- ✅ 5-minute expiration time
- ✅ Maximum 3 verification attempts per OTP
- ✅ Rate limiting (60 seconds between requests, max 5 per day)
- ✅ Dual mode: Testing (console log) & Production (real email)
- ✅ Beautiful HTML email templates
- ✅ Auto-login after successful verification
- ✅ Welcome email after account activation

## Architecture

### Database Schema
```sql
-- OTP Verifications Table
CREATE TABLE otp_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  otp_code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified TINYINT(1) DEFAULT 0,
  attempts INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_expires_at (expires_at)
);

-- Customers Table Updates
ALTER TABLE customers 
ADD COLUMN email_verified TINYINT(1) DEFAULT 0,
ADD COLUMN is_active TINYINT(1) DEFAULT 0;
```

### API Endpoints

#### 1. Register Customer
**POST** `/api/auth/register`

Creates a new customer account and sends OTP email.

**Request Body:**
```json
{
  "name": "John Doe",
  "phone": "081234567890",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Success Response (201):**
```json
{
  "message": "Registrasi berhasil! Kode OTP telah dikirim ke john@example.com",
  "customerId": 123,
  "email": "john@example.com",
  "expiresIn": "5 menit",
  "mode": "testing"
}
```

**Error Responses:**
- `400` - Missing fields, invalid format, or duplicate email/phone
- `500` - Server error or email sending failed

**Validations:**
- Email format: `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- Phone format (Indonesia): `^(\+62|62|0)[0-9]{9,13}$`
- All fields required

---

#### 2. Verify OTP
**POST** `/api/auth/verify-otp`

Verifies OTP code and activates customer account.

**Request Body:**
```json
{
  "email": "john@example.com",
  "otpCode": "123456"
}
```

**Success Response (200):**
```json
{
  "message": "Verifikasi berhasil! Akun Anda telah aktif.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer": {
    "id": 123,
    "name": "John Doe",
    "phone": "081234567890",
    "email": "john@example.com"
  }
}
```

**Error Responses:**
- `400` - Invalid OTP, expired OTP, or max attempts reached
- `500` - Server error

**OTP Validation Rules:**
- Exact match required (case-sensitive)
- Maximum 3 attempts per OTP
- Must verify within 5 minutes
- After 3 failed attempts, user must request new OTP

---

#### 3. Resend OTP
**POST** `/api/auth/resend-otp`

Sends a new OTP code to the registered email.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Success Response (200):**
```json
{
  "message": "Kode OTP baru telah dikirim ke john@example.com",
  "expiresIn": "5 menit",
  "mode": "testing"
}
```

**Error Responses:**
- `400` - Email not registered or already verified
- `429` - Rate limit exceeded (must wait 60 seconds or daily limit reached)
- `500` - Server error

**Rate Limiting:**
- Minimum 60 seconds between requests
- Maximum 5 OTP requests per day per email

---

## Email Configuration

### Testing Mode (Development)
Set in `.env`:
```bash
EMAIL_MODE=testing
```

**Behavior:**
- OTP codes are printed to console
- No real emails sent
- Perfect for local development and testing

**Console Output Example:**
```
📧 ========== EMAIL OTP (TESTING MODE) ==========
To: john@example.com
OTP Code: 123456
Expires: 5 minutes
=============================================
```

---

### Production Mode
Set in `.env`:
```bash
EMAIL_MODE=production
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-16-digit-app-password
EMAIL_FROM=PO Hantar Travel <noreply@pohantar.com>
```

**How to Get Gmail App Password:**
1. Go to [Google Account Settings](https://myaccount.google.com)
2. Security → 2-Step Verification (enable if not already)
3. App Passwords → Generate new password
4. Select "Mail" and "Other" → Name it "PO Hantar Travel"
5. Copy the 16-digit password to `.env`

**Gmail Limitations:**
- Free tier: 500 emails/day
- Suitable for testing and small-scale production
- For production at scale, consider:
  - **Resend** (3,000 free emails/month)
  - **SendGrid** (100 emails/day free)
  - **Mailgun** (5,000 free emails/month)
  - **AWS SES** (62,000 free emails/month)

---

## Email Templates

### OTP Verification Email
- Beautiful gradient header
- Large, centered OTP code
- Clear expiration notice
- Security warnings
- Professional footer

**Preview:**
```
┌────────────────────────────────────────┐
│   🚌 PO HANTAR TRAVEL (Gradient BG)   │
│         Verifikasi Akun Anda           │
└────────────────────────────────────────┘

Halo,

Terima kasih telah mendaftar di PO Hantar Travel.
Gunakan kode OTP di bawah ini untuk memverifikasi akun Anda:

┌────────────────────────────┐
│   Kode Verifikasi Anda:   │
│        1 2 3 4 5 6         │
└────────────────────────────┘

⚠️ Penting:
• Kode berlaku selama 5 menit
• Jangan bagikan kode ini kepada siapa pun
• Jika Anda tidak merasa mendaftar, abaikan email ini

Salam,
Tim PO Hantar Travel
```

### Welcome Email
Sent automatically after successful verification (non-blocking).

---

## Database Migration

Run this SQL on Railway MySQL:

```bash
# Upload migration file
mysql -h host -u user -p database < migrations/create_otp_table.sql
```

Or manually via Railway Dashboard:
1. Open MySQL database in Railway
2. Go to Query tab
3. Copy content from `migrations/create_otp_table.sql`
4. Execute query

---

## Installation

### 1. Install Dependencies
```bash
cd travel_api
npm install nodemailer
```

### 2. Setup Environment Variables
Copy and configure `.env`:
```bash
cp .env.example .env
```

Edit `.env`:
```bash
# For testing (local development)
EMAIL_MODE=testing

# For production (Railway)
EMAIL_MODE=production
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-app-password
```

### 3. Run Database Migration
```bash
# Connect to Railway MySQL
mysql -h host -u user -p database < migrations/create_otp_table.sql
```

### 4. Deploy to Railway
```bash
git add .
git commit -m "Add OTP email verification system"
git push origin main
```

### 5. Set Environment Variables in Railway
Go to Railway Dashboard → travel-api → Variables:
```
EMAIL_MODE=production
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-16-digit-password
EMAIL_FROM=PO Hantar Travel <noreply@pohantar.com>
```

---

## Testing

### 1. Test Registration (Console OTP)
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "phone": "081234567890",
    "email": "test@example.com",
    "password": "password123"
  }'
```

Check console for OTP code:
```
📧 ========== EMAIL OTP (TESTING MODE) ==========
To: test@example.com
OTP Code: 123456
Expires: 5 minutes
=============================================
```

### 2. Test OTP Verification
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otpCode": "123456"
  }'
```

### 3. Test Resend OTP
```bash
curl -X POST http://localhost:3000/api/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

---

## Security Features

1. **Rate Limiting**
   - 60 seconds cooldown between requests
   - Maximum 5 OTP per day per email

2. **OTP Expiration**
   - 5-minute validity period
   - Automatic invalidation after expiry

3. **Attempt Limiting**
   - Maximum 3 verification attempts
   - Forces new OTP request after 3 failures

4. **Password Security**
   - Bcrypt hashing with salt rounds
   - Stored securely in database

5. **Email Validation**
   - Format validation with regex
   - Duplicate check before registration

6. **Phone Validation**
   - Indonesian format validation
   - Duplicate check before registration

---

## Error Handling

### Registration Errors
| Error | Status | Message |
|-------|--------|---------|
| Missing fields | 400 | "Semua field harus diisi" |
| Invalid email | 400 | "Format email tidak valid" |
| Invalid phone | 400 | "Format nomor telepon tidak valid" |
| Email exists | 400 | "Email sudah terdaftar" |
| Phone exists | 400 | "Nomor telepon sudah terdaftar" |
| Email failed | 500 | "Gagal mengirim email verifikasi" |

### Verification Errors
| Error | Status | Message |
|-------|--------|---------|
| OTP not found | 400 | "Kode OTP tidak ditemukan" |
| OTP expired | 400 | "Kode OTP sudah kadaluarsa" |
| Max attempts | 400 | "Terlalu banyak percobaan" |
| Wrong OTP | 400 | "Kode OTP salah. Sisa: X" |

### Resend Errors
| Error | Status | Message |
|-------|--------|---------|
| Email not found | 400 | "Email tidak terdaftar" |
| Already verified | 400 | "Email sudah diverifikasi" |
| Rate limit | 429 | "Tunggu X detik" |
| Daily limit | 429 | "Batas harian tercapai" |

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER REGISTRATION FLOW                │
└─────────────────────────────────────────────────────────────┘

1. User fills registration form
   ├─ Name, Phone, Email, Password
   └─ Submit

2. Frontend calls POST /api/auth/register
   ├─ Validation (format, duplicates)
   ├─ Create customer (inactive)
   ├─ Generate OTP (6 digits)
   ├─ Save OTP to database
   └─ Send OTP email
       ├─ Testing mode: Console log
       └─ Production mode: Gmail SMTP

3. User receives OTP email
   └─ Valid for 5 minutes

4. User enters OTP code in app

5. Frontend calls POST /api/auth/verify-otp
   ├─ Check OTP validity
   ├─ Check expiration
   ├─ Check attempts (max 3)
   └─ Verify OTP code
       ├─ ✅ Correct: Activate account
       │   ├─ Set email_verified = 1
       │   ├─ Set is_active = 1
       │   ├─ Generate JWT token
       │   ├─ Send welcome email
       │   └─ Auto-login user
       └─ ❌ Wrong: Increment attempts
           └─ If attempts >= 3: Request new OTP

6. User logged in ✅
```

---

## Next Steps (Flutter Implementation)

### 1. Create OTP Verification Screen
- 6 input fields for digits
- Countdown timer (5:00)
- Resend button (enabled after 60s)
- Auto-focus next field on input

### 2. Update Registration Flow
```dart
// After successful registration
Navigator.push(
  context,
  MaterialPageRoute(
    builder: (_) => OTPVerificationScreen(
      email: email,
      customerId: customerId,
    ),
  ),
);
```

### 3. Handle Auto-Login
```dart
// After successful OTP verification
final token = response['token'];
final customer = response['customer'];

// Save token to SharedPreferences
await authProvider.saveToken(token, customer);

// Navigate to home screen
Navigator.pushReplacementNamed(context, '/home');
```

---

## Troubleshooting

### Console shows OTP but email not sent
**Solution:** Check `EMAIL_MODE` in Railway variables. Set to `production`.

### Gmail authentication error
**Solution:** 
1. Verify 2-Step Verification is enabled
2. Generate new App Password (not regular password)
3. Copy 16-digit password without spaces

### OTP expired immediately
**Solution:** Check server timezone. Ensure Railway MySQL timezone matches app timezone.

### Daily limit reached error
**Solution:** 
- Wait 24 hours
- Or delete old OTP records:
  ```sql
  DELETE FROM otp_verifications WHERE email = 'user@example.com';
  ```

### Customer not activated after verification
**Solution:** Check customers table:
```sql
SELECT email, email_verified, is_active FROM customers WHERE email = 'user@example.com';
```

---

## Production Checklist

- [ ] Run database migration
- [ ] Install nodemailer (`npm install`)
- [ ] Configure Gmail App Password
- [ ] Set `EMAIL_MODE=production` in Railway
- [ ] Set `EMAIL_USER` and `EMAIL_APP_PASSWORD` in Railway
- [ ] Test with real email address
- [ ] Verify OTP email delivery
- [ ] Test complete registration flow
- [ ] Monitor email sending logs
- [ ] Set up email quota monitoring

---

## Future Enhancements

1. **Email Provider Upgrade**
   - Migrate from Gmail to Resend/SendGrid for better deliverability
   - Higher daily limits
   - Better analytics

2. **SMS OTP Alternative**
   - Add option to receive OTP via SMS
   - Use Twilio or local SMS gateway

3. **Backup Verification**
   - Add security questions
   - Email + SMS dual verification

4. **Admin Dashboard**
   - Monitor OTP statistics
   - View failed verification attempts
   - Manage rate limits

5. **Analytics**
   - Track OTP success rate
   - Monitor email bounce rate
   - Identify problematic email providers

---

## Support

For issues or questions:
1. Check Railway logs: `railway logs`
2. Check email service status
3. Verify environment variables
4. Test with curl commands first
5. Check database records manually

---

**Version:** 1.0.0  
**Last Updated:** December 2025  
**Author:** PO Hantar Travel Development Team
