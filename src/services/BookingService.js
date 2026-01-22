const BaseService = require('./BaseService');
const Booking = require('../models/Booking');
const { validateObjectId, validateCoordinates, validateServiceType, validateBookingStatus } = require('../config/database');

class BookingService extends BaseService {
  constructor() {
    super('BookingService');
  }

  /**
   * Create a new booking
   * @param {Object} bookingData - Booking creation data
   * @returns {Promise<Object>} - Created booking
   */
  async createBooking(bookingData) {
    return this.executeOperation('createBooking', async () => {
      this.validateRequired(bookingData, ['userId', 'artisanId', 'serviceDetails', 'location', 'scheduling']);
      this.validateRequired(bookingData.serviceDetails, ['type', 'description', 'estimatedCost']);
      this.validateRequired(bookingData.location, ['latitude', 'longitude', 'address']);
      this.validateRequired(bookingData.scheduling, ['requestedDate']);

      // Validate ObjectIds
      if (!validateObjectId(bookingData.userId)) {
        throw new Error('Invalid user ID format');
      }
      if (!validateObjectId(bookingData.artisanId)) {
        throw new Error('Invalid artisan ID format');
      }

      // Validate coordinates
      if (!validateCoordinates(bookingData.location.latitude, bookingData.location.longitude)) {
        throw new Error('Invalid coordinates provided');
      }

      // Validate service type
      if (!validateServiceType(bookingData.serviceDetails.type)) {
        throw new Error(`Invalid service type: ${bookingData.serviceDetails.type}`);
      }

      // Set payment amount from estimated cost
      bookingData.payment = {
        amount: bookingData.serviceDetails.estimatedCost,
        method: 'bank_transfer'
      };

      const booking = new Booking(bookingData);
      const savedBooking = await booking.save();

      this.logOperation('bookingCreated', { 
        bookingId: savedBooking._id,
        referenceNumber: savedBooking.referenceNumber,
        userId: bookingData.userId,
        artisanId: bookingData.artisanId
      });

      return savedBooking;
    }, { userId: bookingData.userId, artisanId: bookingData.artisanId });
  }

  /**
   * Get booking by ID
   * @param {string} bookingId - Booking ObjectId
   * @returns {Promise<Object|null>} - Booking or null
   */
  async getBookingById(bookingId) {
    return this.executeOperation('getBookingById', async () => {
      this.validateRequired({ bookingId }, ['bookingId']);

      if (!validateObjectId(bookingId)) {
        throw new Error('Invalid booking ID format');
      }

      return await Booking.findById(bookingId)
        .populate('userId', 'firstName lastName telegramId')
        .populate('artisanId', 'personalInfo businessInfo tier bankDetails');
    }, { bookingId });
  }

  /**
   * Update booking status
   * @param {string} bookingId - Booking ObjectId
   * @param {string} newStatus - New booking status
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} - Updated booking
   */
  async updateBookingStatus(bookingId, newStatus, reason = null) {
    return this.executeOperation('updateBookingStatus', async () => {
      this.validateRequired({ bookingId, newStatus }, ['bookingId', 'newStatus']);

      if (!validateObjectId(bookingId)) {
        throw new Error('Invalid booking ID format');
      }

      if (!validateBookingStatus(newStatus)) {
        throw new Error(`Invalid booking status: ${newStatus}`);
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      booking.updateStatus(newStatus, reason);
      const updatedBooking = await booking.save();

      this.logOperation('statusUpdated', {
        bookingId,
        referenceNumber: booking.referenceNumber,
        oldStatus: booking.status,
        newStatus,
        reason
      });

      return updatedBooking;
    }, { bookingId, newStatus, reason });
  }

  /**
   * Confirm booking with scheduled date
   * @param {string} bookingId - Booking ObjectId
   * @param {Date} confirmedDate - Confirmed service date
   * @param {Object} timeSlot - Time slot object with start and end times
   * @returns {Promise<Object>} - Updated booking
   */
  async confirmBooking(bookingId, confirmedDate, timeSlot = null) {
    return this.executeOperation('confirmBooking', async () => {
      this.validateRequired({ bookingId, confirmedDate }, ['bookingId', 'confirmedDate']);

      if (!validateObjectId(bookingId)) {
        throw new Error('Invalid booking ID format');
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'pending') {
        throw new Error(`Cannot confirm booking with status: ${booking.status}`);
      }

      booking.scheduling.confirmedDate = new Date(confirmedDate);
      if (timeSlot) {
        booking.scheduling.timeSlot = timeSlot;
      }

      booking.updateStatus('confirmed', 'Booking confirmed by artisan');
      const updatedBooking = await booking.save();

      this.logOperation('bookingConfirmed', {
        bookingId,
        referenceNumber: booking.referenceNumber,
        confirmedDate,
        timeSlot
      });

      return updatedBooking;
    }, { bookingId, confirmedDate, timeSlot });
  }

  /**
   * Process payment confirmation
   * @param {string} bookingId - Booking ObjectId
   * @param {string} transferReference - Bank transfer reference
   * @returns {Promise<Object>} - Updated booking
   */
  async processPayment(bookingId, transferReference) {
    return this.executeOperation('processPayment', async () => {
      this.validateRequired({ bookingId, transferReference }, ['bookingId', 'transferReference']);

      if (!validateObjectId(bookingId)) {
        throw new Error('Invalid booking ID format');
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'completed') {
        throw new Error('Can only process payment for completed bookings');
      }

      booking.payment.status = 'paid';
      booking.payment.transferReference = transferReference;
      booking.payment.paidAt = new Date();

      const updatedBooking = await booking.save();

      this.logOperation('paymentProcessed', {
        bookingId,
        referenceNumber: booking.referenceNumber,
        amount: booking.payment.amount,
        transferReference
      });

      return updatedBooking;
    }, { bookingId, transferReference });
  }

  /**
   * Add rating and review to completed booking
   * @param {string} bookingId - Booking ObjectId
   * @param {number} rating - Rating score (1-5)
   * @param {string} review - Review text
   * @returns {Promise<Object>} - Updated booking
   */
  async addRating(bookingId, rating, review = null) {
    return this.executeOperation('addRating', async () => {
      this.validateRequired({ bookingId, rating }, ['bookingId', 'rating']);

      if (!validateObjectId(bookingId)) {
        throw new Error('Invalid booking ID format');
      }

      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      booking.addRating(rating, review);
      const updatedBooking = await booking.save();

      this.logOperation('ratingAdded', {
        bookingId,
        referenceNumber: booking.referenceNumber,
        rating,
        hasReview: !!review
      });

      return updatedBooking;
    }, { bookingId, rating, review });
  }

  /**
   * Get bookings for a user
   * @param {string} userId - User ObjectId
   * @param {string} status - Filter by status (optional)
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} - Array of bookings
   */
  async getUserBookings(userId, status = null, limit = 20) {
    return this.executeOperation('getUserBookings', async () => {
      this.validateRequired({ userId }, ['userId']);

      if (!validateObjectId(userId)) {
        throw new Error('Invalid user ID format');
      }

      if (status && !validateBookingStatus(status)) {
        throw new Error(`Invalid booking status: ${status}`);
      }

      return await Booking.findByUser(userId, status)
        .limit(limit);
    }, { userId, status, limit });
  }

  /**
   * Get bookings for an artisan
   * @param {string} artisanId - Artisan ObjectId
   * @param {string} status - Filter by status (optional)
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} - Array of bookings
   */
  async getArtisanBookings(artisanId, status = null, limit = 20) {
    return this.executeOperation('getArtisanBookings', async () => {
      this.validateRequired({ artisanId }, ['artisanId']);

      if (!validateObjectId(artisanId)) {
        throw new Error('Invalid artisan ID format');
      }

      if (status && !validateBookingStatus(status)) {
        throw new Error(`Invalid booking status: ${status}`);
      }

      return await Booking.findByArtisan(artisanId, status)
        .limit(limit);
    }, { artisanId, status, limit });
  }

  /**
   * Send automated reminders for upcoming bookings
   * @param {number} hoursAhead - Hours before booking to send reminder
   * @returns {Promise<Array>} - Array of bookings that need reminders
   */
  async sendReminders(hoursAhead = 24) {
    return this.executeOperation('sendReminders', async () => {
      const reminderTime = new Date();
      reminderTime.setHours(reminderTime.getHours() + hoursAhead);

      const upcomingBookings = await Booking.find({
        status: 'confirmed',
        'scheduling.confirmedDate': {
          $gte: new Date(),
          $lte: reminderTime
        }
      }).populate('userId artisanId');

      this.logOperation('remindersProcessed', {
        count: upcomingBookings.length,
        hoursAhead
      });

      return upcomingBookings;
    }, { hoursAhead });
  }

  /**
   * Cancel booking
   * @param {string} bookingId - Booking ObjectId
   * @param {string} cancelledBy - Who cancelled (user/artisan/system)
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} - Updated booking
   */
  async cancelBooking(bookingId, cancelledBy, reason) {
    return this.executeOperation('cancelBooking', async () => {
      this.validateRequired({ bookingId, cancelledBy, reason }, ['bookingId', 'cancelledBy', 'reason']);

      if (!validateObjectId(bookingId)) {
        throw new Error('Invalid booking ID format');
      }

      if (!['user', 'artisan', 'system'].includes(cancelledBy)) {
        throw new Error('Invalid cancelledBy value');
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      booking.cancellation = {
        cancelledBy,
        reason,
        cancelledAt: new Date()
      };

      booking.updateStatus('cancelled', reason);
      const updatedBooking = await booking.save();

      this.logOperation('bookingCancelled', {
        bookingId,
        referenceNumber: booking.referenceNumber,
        cancelledBy,
        reason
      });

      return updatedBooking;
    }, { bookingId, cancelledBy, reason });
  }

  /**
   * Get booking statistics
   * @param {Object} filters - Optional filters (dateRange, status, etc.)
   * @returns {Promise<Object>} - Booking statistics
   */
  async getBookingStats(filters = {}) {
    return this.executeOperation('getBookingStats', async () => {
      const matchStage = {};

      if (filters.dateRange) {
        matchStage.createdAt = {
          $gte: new Date(filters.dateRange.start),
          $lte: new Date(filters.dateRange.end)
        };
      }

      if (filters.status) {
        matchStage.status = filters.status;
      }

      const stats = await Booking.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$payment.amount' },
            totalCommission: { $sum: '$payment.commission.amount' },
            averageBookingValue: { $avg: '$payment.amount' },
            statusBreakdown: {
              $push: '$status'
            }
          }
        }
      ]);

      const statusCounts = {};
      if (stats.length > 0) {
        stats[0].statusBreakdown.forEach(status => {
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
      }

      return {
        totalBookings: stats[0]?.totalBookings || 0,
        totalRevenue: stats[0]?.totalRevenue || 0,
        totalCommission: stats[0]?.totalCommission || 0,
        averageBookingValue: stats[0]?.averageBookingValue || 0,
        statusBreakdown: statusCounts
      };
    }, { filters });
  }
}

module.exports = BookingService;