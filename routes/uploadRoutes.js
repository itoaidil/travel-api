const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary (already configured in config/cloudinary.js but we can use it here)
// Cloudinary should be configured via environment variables in main app

// Storage for item photos (delivery package photos)
const itemPhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'delivery_items',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 800, height: 800, crop: 'limit', quality: 'auto' }
    ]
  }
});

// Multer middleware for item photos
const uploadItemPhoto = multer({
  storage: itemPhotoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

/**
 * POST /api/upload/item-photo
 * Upload delivery item photo to Cloudinary
 * Form-data: item_photo (file)
 */
router.post('/item-photo', uploadItemPhoto.single('item_photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    console.log('✅ Item photo uploaded:', req.file.path);

    return res.status(200).json({
      success: true,
      message: 'Photo uploaded successfully',
      photo_url: req.file.path,
      data: {
        url: req.file.path,
        filename: req.file.filename,
        size: req.file.size
      }
    });

  } catch (error) {
    console.error('❌ Error uploading item photo:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload photo',
      error: error.message
    });
  }
});

/**
 * POST /api/upload/chat-image
 * Upload chat image to Cloudinary
 * Form-data: image (file)
 */
const chatImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat_images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [
      { width: 1200, height: 1200, crop: 'limit', quality: 'auto' }
    ]
  }
});

const uploadChatImage = multer({
  storage: chatImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

router.post('/chat-image', uploadChatImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    console.log('✅ Chat image uploaded:', req.file.path);

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      image_url: req.file.path,
      data: {
        url: req.file.path,
        filename: req.file.filename,
        size: req.file.size
      }
    });

  } catch (error) {
    console.error('❌ Error uploading chat image:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

/**
 * POST /api/upload/profile-photo
 * Upload user profile photo to Cloudinary
 * Form-data: photo (file)
 */
const profilePhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profile_photos',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }
    ]
  }
});

const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  limits: {
    fileSize: 3 * 1024 * 1024 // 3MB max
  }
});

router.post('/profile-photo', uploadProfilePhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    console.log('✅ Profile photo uploaded:', req.file.path);

    return res.status(200).json({
      success: true,
      message: 'Photo uploaded successfully',
      photo_url: req.file.path,
      data: {
        url: req.file.path,
        filename: req.file.filename,
        size: req.file.size
      }
    });

  } catch (error) {
    console.error('❌ Error uploading profile photo:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload photo',
      error: error.message
    });
  }
});

module.exports = router;
