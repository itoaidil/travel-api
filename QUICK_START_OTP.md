# 🚀 OTP Email Verification - Quick Start Guide

## ⚡ TL;DR - Deploy in 5 Minutes

### Step 1: Run Database Migration (Railway MySQL)
```bash
# Get database credentials from Railway Dashboard
# Then run:
mysql -h <host> -u <user> -p<password> <database> < migrations/create_otp_table.sql
```

### Step 2: Set Environment Variable in Railway
```
Go to Railway Dashboard → travel-api → Variables → Add:
EMAIL_MODE=testing
```

### Step 3: Deploy
```bash
cd travel_api
./deploy_otp_system.sh
```

### Step 4: Test
```bash
./test_otp_api.sh
```

Done! ✅

---

## 📋 Detailed Steps

### 1. Database Migration

**Option A: Via Railway Dashboard (Easiest)**
1. Open Railway Dashboard
2. Click on MySQL database
3. Go to "Query" tab
4. Copy content from `migrations/create_otp_table.sql`
5. Paste and execute
6. Verify: `SHOW TABLES;` should show `otp_verifications`

**Option B: Via MySQL CLI**
```bash
# Get credentials from Railway Dashboard → MySQL → Connect
mysql -h monorail.proxy.rlwy.net \
      -u root \
      -p<password> \
      railway \
      < migrations/create_otp_table.sql
```

**Verify Migration:**
```sql
-- Check otp_verifications table
DESCRIBE otp_verifications;

-- Check customers table updates
SHOW COLUMNS FROM customers LIKE '%email_verified%';
SHOW COLUMNS FROM customers LIKE '%is_active%';
```

---

### 2. Environment Variables

**Testing Mode (Recommended First):**
```
Railway Dashboard → travel-api → Variables:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL_MODE=testing
```

This will log OTP codes to Railway logs instead of sending emails.

**Production Mode (After Testing):**
```
EMAIL_MODE=production
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-16-digit-app-password
EMAIL_FROM=PO Hantar Travel <noreply@pohantar.com>
```

**How to Get Gmail App Password:**
1. Go to: https://myaccount.google.com/security
2. Enable "2-Step Verification" if not already
3. Go to: https://myaccount.google.com/apppasswords
4. Select "Mail" → "Other" → Name: "PO Hantar Travel"
5. Copy 16-digit password (no spaces)
6. Paste in Railway

---

### 3. Deploy to Railway

**Option A: Using Deployment Script (Recommended)**
```bash
cd travel_api
./deploy_otp_system.sh
```

**Option B: Manual Deployment**
```bash
cd travel_api
git add .
git commit -m "Add OTP email verification system"
git push origin main
```

**Monitor Deployment:**
```bash
railway logs --follow
```

Look for:
- ✅ `Database connected successfully`
- ✅ `Server running on port 3000`

---

### 4. Test Endpoints

**Option A: Using Test Script (Easiest)**
```bash
cd travel_api
./test_otp_api.sh
```

**Option B: Manual Testing with curl**

**Test 1: Register**
```bash
curl -X POST https://travel-api-production-23ae.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "081234567890",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "message": "Registrasi berhasil! Kode OTP telah dikirim ke john@example.com",
  "customerId": 123,
  "email": "john@example.com",
  "expiresIn": "5 menit",
  "mode": "testing"
}
```

**Test 2: Check Railway Logs for OTP**
```bash
railway logs --tail 50
```

Look for:
```
📧 ========== EMAIL OTP (TESTING MODE) ==========
To: john@example.com
OTP Code: 123456
Expires: 5 minutes
=============================================
```

**Test 3: Verify OTP**
```bash
curl -X POST https://travel-api-production-23ae.up.railway.app/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "otpCode": "123456"
  }'
```

**Expected Response:**
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

---

## 🎨 Flutter Implementation (Next Step)

### Files to Create

1. **`lib/screens/otp_verification_screen.dart`**
   - 6 input fields for OTP digits
   - Countdown timer (5:00)
   - Resend button
   - Auto-login on success

2. **`lib/services/otp_service.dart`**
   ```dart
   class OTPService {
     Future<Map<String, dynamic>> register({
       required String name,
       required String phone,
       required String email,
       required String password,
     }) async {
       // POST /api/auth/register
     }

     Future<Map<String, dynamic>> verifyOTP({
       required String email,
       required String otpCode,
     }) async {
       // POST /api/auth/verify-otp
     }

     Future<Map<String, dynamic>> resendOTP({
       required String email,
     }) async {
       // POST /api/auth/resend-otp
     }
   }
   ```

3. **Update `lib/screens/register_screen.dart`**
   ```dart
   // After successful registration
   final response = await otpService.register(
     name: nameController.text,
     phone: phoneController.text,
     email: emailController.text,
     password: passwordController.text,
   );

   if (response['success']) {
     Navigator.push(
       context,
       MaterialPageRoute(
         builder: (_) => OTPVerificationScreen(
           email: emailController.text,
           customerId: response['customerId'],
         ),
       ),
     );
   }
   ```

### Sample OTP Screen UI
```dart
import 'package:flutter/material.dart';

class OTPVerificationScreen extends StatefulWidget {
  final String email;
  final int customerId;

  const OTPVerificationScreen({
    required this.email,
    required this.customerId,
  });

  @override
  _OTPVerificationScreenState createState() => _OTPVerificationScreenState();
}

class _OTPVerificationScreenState extends State<OTPVerificationScreen> {
  final List<TextEditingController> _controllers = 
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = 
      List.generate(6, (_) => FocusNode());
  
  int _remainingSeconds = 300; // 5 minutes
  bool _canResend = false;
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Verifikasi Email')),
      body: Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          children: [
            // Email icon
            Icon(Icons.email, size: 80, color: Colors.blue),
            SizedBox(height: 20),
            
            // Title
            Text(
              'Verifikasi Email Anda',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 10),
            
            // Subtitle
            Text(
              'Kode verifikasi telah dikirim ke\n${widget.email}',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
            SizedBox(height: 30),
            
            // OTP Input Fields
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(6, (index) => _buildOTPField(index)),
            ),
            SizedBox(height: 20),
            
            // Timer
            Text(
              'Kode berlaku: ${_formatTime(_remainingSeconds)}',
              style: TextStyle(color: Colors.orange),
            ),
            SizedBox(height: 20),
            
            // Resend Button
            TextButton(
              onPressed: _canResend ? _resendOTP : null,
              child: Text(_canResend 
                ? 'Kirim Ulang Kode' 
                : 'Kirim Ulang (${60 - _resendCounter}s)'),
            ),
            SizedBox(height: 20),
            
            // Verify Button
            ElevatedButton(
              onPressed: _isLoading ? null : _verifyOTP,
              child: _isLoading 
                ? CircularProgressIndicator(color: Colors.white)
                : Text('Verifikasi'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOTPField(int index) {
    return Container(
      width: 45,
      height: 55,
      child: TextField(
        controller: _controllers[index],
        focusNode: _focusNodes[index],
        keyboardType: TextInputType.number,
        maxLength: 1,
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
        decoration: InputDecoration(
          counterText: '',
          border: OutlineInputBorder(),
        ),
        onChanged: (value) {
          if (value.isNotEmpty && index < 5) {
            _focusNodes[index + 1].requestFocus();
          }
          if (value.isEmpty && index > 0) {
            _focusNodes[index - 1].requestFocus();
          }
        },
      ),
    );
  }

  String _formatTime(int seconds) {
    int minutes = seconds ~/ 60;
    int secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  Future<void> _verifyOTP() async {
    String otp = _controllers.map((c) => c.text).join();
    
    if (otp.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Masukkan 6 digit kode OTP')),
      );
      return;
    }

    setState(() => _isLoading = true);
    
    try {
      final response = await OTPService().verifyOTP(
        email: widget.email,
        otpCode: otp,
      );
      
      if (response['success']) {
        // Save token and navigate to home
        Navigator.pushReplacementNamed(context, '/home');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Verifikasi gagal: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _resendOTP() async {
    // Implementation for resend OTP
  }
}
```

---

## 📊 Monitoring

### Check OTP Records
```sql
-- View all OTP records
SELECT * FROM otp_verifications 
ORDER BY created_at DESC 
LIMIT 10;

-- Check specific email
SELECT * FROM otp_verifications 
WHERE email = 'john@example.com';

-- View verified customers
SELECT id, name, email, email_verified, is_active 
FROM customers 
WHERE email_verified = 1;
```

### Railway Logs
```bash
# Real-time logs
railway logs --follow

# Last 100 lines
railway logs --tail 100

# Search for OTP
railway logs | grep "OTP Code"
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| OTP not in logs | Check `EMAIL_MODE=testing` in Railway |
| Email not sent | Verify Gmail App Password (16 digits) |
| Rate limit error | Wait 60 seconds or delete OTP record |
| OTP expired | Must verify within 5 minutes |
| Wrong OTP | Max 3 attempts, then request new OTP |
| Table not found | Run database migration |

---

## ✅ Checklist

- [ ] Database migration executed
- [ ] `EMAIL_MODE=testing` set in Railway
- [ ] Code deployed to Railway
- [ ] Registration endpoint tested
- [ ] OTP code appears in logs
- [ ] Verification endpoint tested
- [ ] Customer account activated
- [ ] JWT token received
- [ ] Ready for Flutter implementation

---

## 📚 Full Documentation

For complete details, see:
- `OTP_SYSTEM_DOCUMENTATION.md` - Complete API reference
- `OTP_IMPLEMENTATION_SUMMARY.md` - Implementation details

---

## 🆘 Need Help?

1. Check Railway logs: `railway logs`
2. Verify database tables exist
3. Test with `./test_otp_api.sh`
4. Read troubleshooting in main documentation

---

**Status:** ✅ Ready to Deploy  
**Est. Time:** 5-10 minutes  
**Difficulty:** ⭐⭐⭐☆☆ (Intermediate)
