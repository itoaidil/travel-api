const { Resend } = require('resend');

/**
 * Email Service for OTP Verification
 * Supports two modes: testing (console log) and production (real email)
 */

// Email configuration based on environment
const EMAIL_MODE = process.env.EMAIL_MODE || 'testing'; // 'testing' or 'production'
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Hantar Travel <noreply@primarylineindo.com>';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// NOTE: SMTP is disabled - Railway blocks outbound SMTP (port 465/587).
// Email is sent via Resend HTTP API only.
if (EMAIL_MODE === 'production') {
  if (RESEND_API_KEY) {
    console.log('✅ Email service ready: Resend HTTP API');
    console.log('📧 From:', EMAIL_FROM);
  } else {
    console.warn('⚠️  RESEND_API_KEY not set. OTP emails will be logged to console only.');
  }
}

/**
 * Generate random 6-digit OTP code
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP email to user (non-blocking, never throws)
 * @param {string} email - Recipient email address
 * @param {string} otpCode - 6-digit OTP code
 * @returns {Promise<boolean>} - Always returns true/false, never throws
 */
async function sendOTPEmail(email, otpCode) {
  try {
    const emailSubject = 'Kode Verifikasi Hantar Travel';
    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 40px 30px;
    }
    .otp-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 36px;
      font-weight: bold;
      letter-spacing: 8px;
      text-align: center;
      padding: 20px;
      border-radius: 8px;
      margin: 30px 0;
    }
    .info {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .info ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .info li {
      margin: 5px 0;
      color: #856404;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #6c757d;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚚 Hantar Travel</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">Verifikasi Akun Anda</p>
    </div>
    
    <div class="content">
      <p style="font-size: 16px; color: #333;">Halo,</p>
      
      <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Terima kasih telah mendaftar di <strong>Hantar Travel</strong>. 
        Gunakan kode OTP di bawah ini untuk memverifikasi akun Anda:
      </p>
      
      <div class="otp-box">${otpCode}</div>
      
      <div class="info">
        <strong>⚠️ Penting:</strong>
        <ul>
          <li>Kode berlaku selama <strong>5 menit</strong></li>
          <li>Jangan bagikan kode ini kepada siapa pun</li>
          <li>Maksimal 3 kali percobaan verifikasi</li>
          <li>Jika Anda tidak merasa mendaftar, abaikan email ini</li>
        </ul>
      </div>
      
      <p style="font-size: 14px; color: #777; margin-top: 30px;">
        Jika Anda mengalami kesulitan, silakan hubungi customer service kami.
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 5px 0;">© ${new Date().getFullYear()} Hantar Travel</p>
      <p style="margin: 5px 0;">Layanan Pengiriman Paket Terpercaya</p>
    </div>
  </div>
</body>
</html>
  `;

  // PRODUCTION MODE: Send via Resend HTTP API (SMTP disabled on Railway)
  if (EMAIL_MODE === 'production' && resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: emailSubject,
        html: emailHTML
      });

      if (error) {
        console.error('⚠️  Resend send error:', error.message || error);
        return false;
      } else {
        console.log('✅ OTP email sent via Resend to:', email, '| id:', data?.id);
        return true;
      }
    } catch (err) {
      console.error('⚠️  Resend exception:', err.message || err);
      return false;
    }
  }

  // Production but no Resend key configured
  if (EMAIL_MODE === 'production') {
    console.error('❌ OTP email not sent: RESEND_API_KEY not set in production mode');
    return false;
  }

  // Testing mode fallback: log OTP to console.
  console.log('\n📧 ========== EMAIL OTP (FALLBACK) ==========');
  console.log('To:', email);
  console.log('OTP Code:', otpCode);
  console.log('Expires: 5 minutes');
  console.log('=============================================\n');
  return true;
} catch (outerError) {
  // Outer try-catch: never throw, always return false
  console.error('⚠️  Unexpected error in sendOTPEmail:', outerError.message || outerError);
  return false;
}
}

/**
 * Send welcome email after successful verification
 * @param {string} email - Recipient email
 * @param {string} name - Customer name
 */
async function sendWelcomeEmail(email, name) {
  const emailSubject = 'Selamat Datang di Hantar Travel!';
  const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Selamat Datang!</h1>
    </div>
    <div class="content">
      <h2>Halo ${name},</h2>
      <p>Akun Anda telah berhasil diverifikasi!</p>
      <p>Anda sekarang dapat menikmati layanan pengiriman paket dengan Hantar Travel.</p>
      <p><strong>Fitur yang tersedia:</strong></p>
      <ul>
        <li>✅ Pesan pengiriman paket online</li>
        <li>✅ Tracking real-time</li>
        <li>✅ Harga transparan</li>
        <li>✅ Driver terverifikasi</li>
      </ul>
      <p>Terima kasih telah bergabung dengan kami!</p>
      <p style="margin-top: 30px; color: #777; font-size: 14px;">
        Salam,<br>Tim Hantar Travel
      </p>
    </div>
  </div>
</body>
</html>
  `;

  if (EMAIL_MODE === 'testing' || !transporter) {
    console.log('📧 Welcome email (testing mode) for:', email);
    return true;
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: emailSubject,
      html: emailHTML
    });
    console.log('✅ Welcome email sent to:', email);
    return true;
  } catch (error) {
    console.error('⚠️  Failed to send welcome email:', error.message);
    // Don't throw error - welcome email is non-critical
    return false;
  }
}

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendWelcomeEmail
};
