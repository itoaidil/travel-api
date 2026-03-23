const admin = require('firebase-admin');
const db = require('../config/database');

function isUnregisteredTokenError(error) {
  const code = error?.code || error?.errorInfo?.code || '';
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}

async function clearInvalidDriverTokens(tokens = []) {
  if (!tokens.length) return;

  try {
    const placeholders = tokens.map(() => '?').join(',');
    await db.query(
      `UPDATE independent_drivers
       SET fcm_token = NULL,
           updated_at = NOW()
       WHERE fcm_token IN (${placeholders})`,
      tokens
    );
    console.log(`🧹 Cleared ${tokens.length} invalid FCM token(s) from independent_drivers`);
  } catch (error) {
    console.error('❌ Failed to clear invalid FCM tokens:', error.message);
  }
}

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
 * Save notification to database
 */
async function saveNotificationToDatabase(driverId, bookingData, notificationType = 'new_booking') {
  try {
    const title = notificationType === 'new_booking' ? '🚚 Pesanan Baru!' : 'Notifikasi';
    const message = `Pengiriman ${bookingData.item_type || 'paket'} - Jarak ${bookingData.distance_km || 0}km`;
    
    await db.query(
      `INSERT INTO driver_notifications 
       (driver_id, booking_id, notification_type, title, message, data, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        driverId,
        bookingData.booking_id,
        notificationType,
        title,
        message,
        JSON.stringify(bookingData)
      ]
    );
    
    console.log(`✅ Notification saved to database for driver ${driverId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error saving notification to database:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get icon and title based on vehicle type and item type
 */
function getNotificationContent(bookingData) {
  const vehicleType = bookingData.vehicle_type || '';
  const itemType = bookingData.item_type;
  
  // If no item_type, it's likely a ride (passenger)
  if (!itemType && vehicleType === 'motorcycle') {
    return {
      icon: '🏍️',
      title: 'Pesanan Motor!',
      body: `Antar Penumpang - Jarak ${bookingData.distance_km || 0}km`
    };
  }
  
  // Delivery with specific vehicle icons
  const iconMap = {
    'motorcycle': '🏍️',
    'bike': '🚲',
    'car': '🚗',
    'truck': '🚚',
    'skateboard': '🛹',
    'wheels': '🛼'
  };
  
  const icon = iconMap[vehicleType] || '📦';
  
  return {
    icon: icon,
    title: `${icon} Pesanan Baru!`,
    body: itemType 
      ? `Pengiriman ${itemType} - Jarak ${bookingData.distance_km || 0}km`
      : `Pesanan ${vehicleType} - Jarak ${bookingData.distance_km || 0}km`
  };
}

/**
 * Send push notification to driver about new booking
 * @param {string} fcmToken - Driver's FCM token
 * @param {object} bookingData - Booking information
 * @param {number} driverId - Driver ID (optional, for saving to database)
 */
async function sendNewBookingNotification(fcmToken, bookingData, driverId = null) {
  if (!fcmToken) {
    console.log('⚠️ No FCM token provided, skipping notification');
    return { success: false, error: 'No FCM token' };
  }

  const content = getNotificationContent(bookingData);

  const message = {
    token: fcmToken,
    notification: {
      title: content.title,
      body: content.body,
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
    
    // Save notification to database if driver_id is provided
    if (driverId) {
      await saveNotificationToDatabase(driverId, bookingData, 'new_booking');
    }
    
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Error sending notification:', error);

    if (isUnregisteredTokenError(error)) {
      await clearInvalidDriverTokens([fcmToken]);
    }

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

  const content = getNotificationContent(bookingData);

  const message = {
    notification: {
      title: content.title,
      body: content.body,
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

    const invalidTokens = [];
    
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Failed to send to token ${idx}:`, resp.error);
          if (isUnregisteredTokenError(resp.error)) {
            invalidTokens.push(fcmTokens[idx]);
          }
        }
      });
    }

    if (invalidTokens.length > 0) {
      await clearInvalidDriverTokens(invalidTokens);
    }
    
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokenCount: invalidTokens.length
    };
  } catch (error) {
    console.error('❌ Error sending multicast notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to single driver (for chat messages)
 * @param {string} fcmToken - Driver's FCM token
 * @param {object} messageData - Message information
 */
async function sendNotificationToSingleDriver(fcmToken, messageData) {
  if (!fcmToken) {
    console.log('⚠️ No FCM token provided for driver notification');
    return { success: false, error: 'No FCM token' };
  }

  const message = {
    token: fcmToken,
    notification: {
      title: `💬 ${messageData.sender_name || 'Customer'}`,
      body: messageData.message_text || 'Sent a message',
    },
    data: {
      type: 'chat_message',
      booking_id: String(messageData.booking_id || ''),
      sender_id: String(messageData.sender_id || ''),
      sender_type: messageData.sender_type || 'customer',
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'chat_channel',
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Chat notification sent to driver:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Error sending chat notification:', error);

    if (isUnregisteredTokenError(error)) {
      await clearInvalidDriverTokens([fcmToken]);
    }

    return { success: false, error: error.message };
  }
}

/**
 * Send booking already taken notification to a driver
 * @param {string} fcmToken - Driver's FCM token
 * @param {object} bookingData - Booking information
 */
async function sendBookingTakenNotificationToDriver(fcmToken, bookingData = {}) {
  if (!fcmToken) {
    console.log('⚠️ No FCM token provided for booking-taken notification');
    return { success: false, error: 'No FCM token' };
  }

  const message = {
    token: fcmToken,
    notification: {
      title: '⚠️ Pesanan Sudah Diambil',
      body: 'Pesanan ini sudah diambil driver lain. Tunggu order berikutnya ya.',
    },
    data: {
      type: 'booking_taken',
      booking_id: String(bookingData.booking_id || ''),
      booking_code: String(bookingData.booking_code || ''),
      taken_by_driver: String(bookingData.taken_by_driver || ''),
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
    console.log('✅ Booking-taken notification sent:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Error sending booking-taken notification:', error);

    if (isUnregisteredTokenError(error)) {
      await clearInvalidDriverTokens([fcmToken]);
    }

    return { success: false, error: error.message };
  }
}

module.exports = {
  sendNewBookingNotification,
  sendNotificationToMultipleDrivers,
  sendNotificationToSingleDriver,
  sendBookingTakenNotificationToDriver,
  saveNotificationToDatabase,
};
