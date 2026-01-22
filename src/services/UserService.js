const BaseService = require('./BaseService');
const User = require('../models/User');
const { validateObjectId, validateCoordinates } = require('../config/database');

class UserService extends BaseService {
  constructor() {
    super('UserService');
  }

  /**
   * Create a new user from Telegram data
   * @param {Object} telegramUser - Telegram user object
   * @returns {Promise<Object>} - Created user
   */
  async createUser(telegramUser) {
    return this.executeOperation('createUser', async () => {
      this.validateRequired(telegramUser, ['id', 'first_name']);

      const userData = {
        telegramId: telegramUser.id,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name || null,
        username: telegramUser.username || null
      };

      const existingUser = await User.findByTelegramId(telegramUser.id);
      if (existingUser) {
        // Update existing user with latest Telegram data
        Object.assign(existingUser, userData);
        return await existingUser.save();
      }

      const user = new User(userData);
      return await user.save();
    }, { telegramId: telegramUser.id });
  }

  /**
   * Get user profile by Telegram ID
   * @param {number} telegramId - Telegram user ID
   * @returns {Promise<Object|null>} - User profile or null
   */
  async getUserProfile(telegramId) {
    return this.executeOperation('getUserProfile', async () => {
      this.validateRequired({ telegramId }, ['telegramId']);
      return await User.findByTelegramId(telegramId);
    }, { telegramId });
  }

  /**
   * Get user profile by MongoDB ObjectId
   * @param {string} userId - MongoDB ObjectId
   * @returns {Promise<Object|null>} - User profile or null
   */
  async getUserById(userId) {
    return this.executeOperation('getUserById', async () => {
      this.validateRequired({ userId }, ['userId']);
      
      if (!validateObjectId(userId)) {
        throw new Error('Invalid user ID format');
      }

      return await User.findById(userId);
    }, { userId });
  }

  /**
   * Update user's location
   * @param {number} telegramId - Telegram user ID
   * @param {Object} location - Location object with latitude, longitude, address
   * @returns {Promise<Object>} - Updated user
   */
  async updateUserLocation(telegramId, location) {
    return this.executeOperation('updateUserLocation', async () => {
      this.validateRequired({ telegramId, location }, ['telegramId', 'location']);
      this.validateRequired(location, ['latitude', 'longitude']);

      if (!validateCoordinates(location.latitude, location.longitude)) {
        throw new Error('Invalid coordinates provided');
      }

      const user = await User.findByTelegramId(telegramId);
      if (!user) {
        throw new Error('User not found');
      }

      user.location = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || user.location?.address || null
      };

      return await user.save();
    }, { telegramId, location });
  }

  /**
   * Update user preferences
   * @param {number} telegramId - Telegram user ID
   * @param {Object} preferences - User preferences
   * @returns {Promise<Object>} - Updated user
   */
  async updateUserPreferences(telegramId, preferences) {
    return this.executeOperation('updateUserPreferences', async () => {
      this.validateRequired({ telegramId, preferences }, ['telegramId', 'preferences']);

      const user = await User.findByTelegramId(telegramId);
      if (!user) {
        throw new Error('User not found');
      }

      // Merge preferences with existing ones
      user.preferences = {
        ...user.preferences,
        ...preferences
      };

      return await user.save();
    }, { telegramId, preferences });
  }

  /**
   * Get user's booking history
   * @param {number} telegramId - Telegram user ID
   * @param {number} limit - Maximum number of bookings to return
   * @returns {Promise<Array>} - Array of bookings
   */
  async getUserBookingHistory(telegramId, limit = 10) {
    return this.executeOperation('getUserBookingHistory', async () => {
      this.validateRequired({ telegramId }, ['telegramId']);

      const user = await User.findByTelegramId(telegramId);
      if (!user) {
        throw new Error('User not found');
      }

      return await User.findById(user._id)
        .populate({
          path: 'bookingHistory',
          options: { 
            sort: { createdAt: -1 }, 
            limit: limit 
          },
          populate: {
            path: 'artisanId',
            select: 'personalInfo businessInfo tier'
          }
        });
    }, { telegramId, limit });
  }

  /**
   * Add booking to user's history
   * @param {number} telegramId - Telegram user ID
   * @param {string} bookingId - Booking ObjectId
   * @returns {Promise<Object>} - Updated user
   */
  async addBookingToHistory(telegramId, bookingId) {
    return this.executeOperation('addBookingToHistory', async () => {
      this.validateRequired({ telegramId, bookingId }, ['telegramId', 'bookingId']);

      if (!validateObjectId(bookingId)) {
        throw new Error('Invalid booking ID format');
      }

      const user = await User.findByTelegramId(telegramId);
      if (!user) {
        throw new Error('User not found');
      }

      // Add booking to history if not already present
      if (!user.bookingHistory.includes(bookingId)) {
        user.bookingHistory.push(bookingId);
        return await user.save();
      }

      return user;
    }, { telegramId, bookingId });
  }

  /**
   * Check if user has set location
   * @param {number} telegramId - Telegram user ID
   * @returns {Promise<boolean>} - True if user has location set
   */
  async hasUserLocation(telegramId) {
    return this.executeOperation('hasUserLocation', async () => {
      this.validateRequired({ telegramId }, ['telegramId']);

      const user = await User.findByTelegramId(telegramId);
      if (!user) {
        return false;
      }

      return user.hasLocation();
    }, { telegramId });
  }

  /**
   * Deactivate user account
   * @param {number} telegramId - Telegram user ID
   * @returns {Promise<Object>} - Updated user
   */
  async deactivateUser(telegramId) {
    return this.executeOperation('deactivateUser', async () => {
      this.validateRequired({ telegramId }, ['telegramId']);

      const user = await User.findByTelegramId(telegramId);
      if (!user) {
        throw new Error('User not found');
      }

      user.isActive = false;
      return await user.save();
    }, { telegramId });
  }

  /**
   * Get user statistics
   * @param {number} telegramId - Telegram user ID
   * @returns {Promise<Object>} - User statistics
   */
  async getUserStats(telegramId) {
    return this.executeOperation('getUserStats', async () => {
      this.validateRequired({ telegramId }, ['telegramId']);

      const user = await User.findByTelegramId(telegramId)
        .populate('bookingHistory');

      if (!user) {
        throw new Error('User not found');
      }

      const bookings = user.bookingHistory || [];
      const completedBookings = bookings.filter(b => b.status === 'completed');
      const totalSpent = completedBookings.reduce((sum, b) => sum + (b.payment?.amount || 0), 0);

      return {
        totalBookings: bookings.length,
        completedBookings: completedBookings.length,
        totalSpent,
        averageRating: completedBookings.length > 0 
          ? completedBookings.reduce((sum, b) => sum + (b.rating?.score || 0), 0) / completedBookings.length 
          : 0,
        memberSince: user.createdAt,
        hasLocation: user.hasLocation(),
        preferredServices: user.preferences?.serviceTypes || []
      };
    }, { telegramId });
  }
}

module.exports = UserService;