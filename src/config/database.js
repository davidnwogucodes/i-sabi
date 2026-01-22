const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Import models to ensure they're registered
require('../models/User');
require('../models/Artisan');
require('../models/Booking');

const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    // Connection options
    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    await mongoose.connect(mongoUri, options);

    logger.info('Connected to MongoDB successfully');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

// Validation helper functions
const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const validateCoordinates = (latitude, longitude) => {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  );
};

const validateServiceType = (serviceType) => {
  const validTypes = ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting', 'hvac', 'landscaping', 'other'];
  return validTypes.includes(serviceType);
};

const validateTier = (tier) => {
  const validTiers = ['Foundation', 'Professional', 'Elite'];
  return validTiers.includes(tier);
};

const validateBookingStatus = (status) => {
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed'];
  return validStatuses.includes(status);
};

module.exports = { 
  connectDatabase,
  validateObjectId,
  validateCoordinates,
  validateServiceType,
  validateTier,
  validateBookingStatus
};