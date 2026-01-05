const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log('✅ Firebase Admin initialized for notifications');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
  }
}

/**
 * Send push notification to driver about new booking
 * @param {string} fcmToken - Driver's FCM token
 * @param {object} bookingData - Booking information
 */
async function sendNewBookingNotification(fcmToken, bookingData) {
  if (!fcmToken) {
    console.log('⚠️ No FCM token provided, skipping notification');
    return { success: false, error: 'No FCM token' };
  }

  const message = {
    token: fcmToken,
    notification: {
      title: '🚚 Pesanan Baru!',
      body: `Pengiriman ${bookingData.item_type || 'paket'} - Jarak ${bookingData.distance_km || 0}km`,
    },
    data: {
      type: 'new_booking',
      booking_id: String(bookingData.booking_id),
      booking_code: bookingData.booking_code || '',
      vehicle_type: bookingData.vehicle_type || '',
      pickup_address: bookingData.pickup_address || '',
      dropoff_address: bookingData.dropoff_address || '',
      distance_km: String(bookingData.distance_km || 0),
      total_fare: String(bookingData.total_fare || 0),
      pickup_lat: String(bookingData.pickup_lat || 0),
      pickup_lng: String(bookingData.pickup_lng || 0),
      item_type: bookingData.item_type || '',
      item_size: bookingData.item_size || '',
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'booking_channel',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to multiple drivers
 * @param {Array<string>} fcmTokens - Array of FCM tokens
 * @param {object} bookingData - Booking information
 */
async function sendNotificationToMultipleDrivers(fcmTokens, bookingData) {
  if (!fcmTokens || fcmTokens.length === 0) {
    console.log('⚠️ No FCM tokens provided');
    return { success: false, error: 'No FCM tokens' };
  }

  const message = {
    notification: {
      title: '🚚 Pesanan Baru!',
      body: `Pengiriman ${bookingData.item_type || 'paket'} - Jarak ${bookingData.distance_km || 0}km`,
    },
    data: {
      type: 'new_booking',
      booking_id: String(bookingData.booking_id),
      booking_code: bookingData.booking_code || '',
      vehicle_type: bookingData.vehicle_type || '',
      pickup_address: bookingData.pickup_address || '',
      dropoff_address: bookingData.dropoff_address || '',
      distance_km: String(bookingData.distance_km || 0),
      total_fare: String(bookingData.total_fare || 0),
      pickup_lat: String(bookingData.pickup_lat || 0),
      pickup_lng: String(bookingData.pickup_lng || 0),
    },
    android: {
      priority: 'high',
    },
    tokens: fcmTokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Sent to ${response.successCount}/${fcmTokens.length} drivers`);
    
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Failed to send to token ${idx}:`, resp.error);
        }
      });
    }
    
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount 
    };
  } catch (error) {
    console.error('❌ Error sending multicast notification:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendNewBookingNotification,
  sendNotificationToMultipleDrivers,
};
