const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BookingService = require('../../src/services/BookingService');
const Booking = require('../../src/models/Booking');
const User = require('../../src/models/User');
const Artisan = require('../../src/models/Artisan');

describe('BookingService', () => {
  let mongoServer;
  let bookingService;
  let testUser;
  let testArtisan;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    bookingService = new BookingService();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Booking.deleteMany({});
    await User.deleteMany({});
    await Artisan.deleteMany({});

    // Create test user and artisan
    testUser = await new User({
      telegramId: 123456789,
      firstName: 'John',
      lastName: 'Doe'
    }).save();

    testArtisan = await new Artisan({
      telegramId: 987654321,
      personalInfo: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+2348012345678'
      },
      businessInfo: {
        serviceTypes: ['plumbing'],
        yearsExperience: 5
      },
      location: {
        latitude: 6.5244,
        longitude: 3.3792,
        address: 'Lagos, Nigeria'
      },
      bankDetails: {
        accountName: 'Jane Smith',
        accountNumber: '1234567890',
        bankName: 'First Bank'
      }
    }).save();
  });

  const mockBookingData = {
    serviceDetails: {
      type: 'plumbing',
      description: 'Fix leaking pipe in kitchen',
      urgency: 'medium',
      estimatedDuration: 2,
      estimatedCost: 5000
    },
    scheduling: {
      requestedDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      timeSlot: {
        start: '09:00',
        end: '11:00'
      }
    },
    location: {
      latitude: 6.5244,
      longitude: 3.3792,
      address: 'Test Address, Lagos'
    }
  };

  describe('createBooking', () => {
    test('should create a new booking', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      
      expect(booking).toBeTruthy();
      expect(booking.userId.toString()).toBe(testUser._id.toString());
      expect(booking.artisanId.toString()).toBe(testArtisan._id.toString());
      expect(booking.status).toBe('pending');
      expect(booking.payment.amount).toBe(5000);
      expect(booking.referenceNumber).toMatch(/^BK[A-Z0-9]{8}$/);
    });

    test('should throw error for invalid user ID', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: 'invalid-id',
        artisanId: testArtisan._id
      };

      await expect(bookingService.createBooking(bookingData))
        .rejects.toThrow('Invalid user ID format');
    });

    test('should throw error for invalid coordinates', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id,
        location: {
          ...mockBookingData.location,
          latitude: 91 // Invalid
        }
      };

      await expect(bookingService.createBooking(bookingData))
        .rejects.toThrow('Invalid coordinates');
    });

    test('should throw error for invalid service type', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id,
        serviceDetails: {
          ...mockBookingData.serviceDetails,
          type: 'invalid_service'
        }
      };

      await expect(bookingService.createBooking(bookingData))
        .rejects.toThrow('Invalid service type');
    });
  });

  describe('getBookingById', () => {
    test('should get booking by ID with populated data', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const createdBooking = await bookingService.createBooking(bookingData);
      const booking = await bookingService.getBookingById(createdBooking._id);
      
      expect(booking).toBeTruthy();
      expect(booking.userId.firstName).toBe('John');
      expect(booking.artisanId.personalInfo.firstName).toBe('Jane');
    });

    test('should throw error for invalid booking ID', async () => {
      await expect(bookingService.getBookingById('invalid-id'))
        .rejects.toThrow('Invalid booking ID format');
    });
  });

  describe('updateBookingStatus', () => {
    test('should update booking status', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      const updatedBooking = await bookingService.updateBookingStatus(
        booking._id, 
        'confirmed', 
        'Artisan accepted the job'
      );
      
      expect(updatedBooking.status).toBe('confirmed');
      expect(updatedBooking.communication.length).toBeGreaterThan(0);
    });

    test('should throw error for invalid status', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      
      await expect(bookingService.updateBookingStatus(booking._id, 'invalid_status'))
        .rejects.toThrow('Invalid booking status');
    });
  });

  describe('confirmBooking', () => {
    test('should confirm booking with date and time slot', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      const confirmedDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // Day after tomorrow
      const timeSlot = { start: '10:00', end: '12:00' };
      
      const confirmedBooking = await bookingService.confirmBooking(
        booking._id, 
        confirmedDate, 
        timeSlot
      );
      
      expect(confirmedBooking.status).toBe('confirmed');
      expect(confirmedBooking.scheduling.confirmedDate).toEqual(confirmedDate);
      expect(confirmedBooking.scheduling.timeSlot).toEqual(timeSlot);
    });

    test('should throw error for non-pending booking', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      await bookingService.updateBookingStatus(booking._id, 'cancelled');
      
      const confirmedDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      
      await expect(bookingService.confirmBooking(booking._id, confirmedDate))
        .rejects.toThrow('Cannot confirm booking with status: cancelled');
    });
  });

  describe('processPayment', () => {
    test('should process payment for completed booking', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      await bookingService.updateBookingStatus(booking._id, 'completed');
      
      const updatedBooking = await bookingService.processPayment(
        booking._id, 
        'TXN123456789'
      );
      
      expect(updatedBooking.payment.status).toBe('paid');
      expect(updatedBooking.payment.transferReference).toBe('TXN123456789');
      expect(updatedBooking.payment.paidAt).toBeInstanceOf(Date);
    });

    test('should throw error for non-completed booking', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      
      await expect(bookingService.processPayment(booking._id, 'TXN123456789'))
        .rejects.toThrow('Can only process payment for completed bookings');
    });
  });

  describe('addRating', () => {
    test('should add rating to completed booking', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      await bookingService.updateBookingStatus(booking._id, 'completed');
      
      const ratedBooking = await bookingService.addRating(
        booking._id, 
        5, 
        'Excellent work!'
      );
      
      expect(ratedBooking.rating.score).toBe(5);
      expect(ratedBooking.rating.review).toBe('Excellent work!');
      expect(ratedBooking.rating.ratedAt).toBeInstanceOf(Date);
    });

    test('should throw error for invalid rating', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      await bookingService.updateBookingStatus(booking._id, 'completed');
      
      await expect(bookingService.addRating(booking._id, 6))
        .rejects.toThrow('Rating must be between 1 and 5');
    });
  });

  describe('getUserBookings', () => {
    test('should get bookings for user', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      await bookingService.createBooking(bookingData);
      
      const userBookings = await bookingService.getUserBookings(testUser._id);
      expect(userBookings.length).toBe(1);
      expect(userBookings[0].userId.toString()).toBe(testUser._id.toString());
    });

    test('should filter bookings by status', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      await bookingService.updateBookingStatus(booking._id, 'confirmed');
      
      const confirmedBookings = await bookingService.getUserBookings(testUser._id, 'confirmed');
      expect(confirmedBookings.length).toBe(1);
      
      const pendingBookings = await bookingService.getUserBookings(testUser._id, 'pending');
      expect(pendingBookings.length).toBe(0);
    });
  });

  describe('cancelBooking', () => {
    test('should cancel booking', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      
      const cancelledBooking = await bookingService.cancelBooking(
        booking._id, 
        'user', 
        'Changed my mind'
      );
      
      expect(cancelledBooking.status).toBe('cancelled');
      expect(cancelledBooking.cancellation.cancelledBy).toBe('user');
      expect(cancelledBooking.cancellation.reason).toBe('Changed my mind');
    });

    test('should throw error for invalid cancelledBy value', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = await bookingService.createBooking(bookingData);
      
      await expect(bookingService.cancelBooking(booking._id, 'invalid', 'reason'))
        .rejects.toThrow('Invalid cancelledBy value');
    });
  });

  describe('getBookingStats', () => {
    test('should return booking statistics', async () => {
      const bookingData = {
        ...mockBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      await bookingService.createBooking(bookingData);
      
      const stats = await bookingService.getBookingStats();
      expect(stats).toHaveProperty('totalBookings');
      expect(stats).toHaveProperty('totalRevenue');
      expect(stats).toHaveProperty('statusBreakdown');
      expect(stats.totalBookings).toBe(1);
    });
  });

  describe('error handling', () => {
    test('should handle missing required parameters', async () => {
      await expect(bookingService.createBooking({}))
        .rejects.toThrow('Missing required parameters');
    });

    test('should handle invalid ObjectId', async () => {
      await expect(bookingService.getBookingById('invalid-id'))
        .rejects.toThrow('Invalid booking ID format');
    });
  });
});