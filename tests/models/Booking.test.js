const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Booking = require('../../src/models/Booking');
const User = require('../../src/models/User');
const Artisan = require('../../src/models/Artisan');

describe('Booking Model', () => {
  let mongoServer;
  let testUser;
  let testArtisan;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
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

  const validBookingData = {
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
    },
    payment: {
      amount: 5000
    }
  };

  describe('Schema Validation', () => {
    test('should create a valid booking', async () => {
      const bookingData = {
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      };

      const booking = new Booking(bookingData);
      const savedBooking = await booking.save();

      expect(savedBooking._id).toBeDefined();
      expect(savedBooking.status).toBe('pending');
      expect(savedBooking.referenceNumber).toMatch(/^BK[A-Z0-9]{8}$/);
      expect(savedBooking.payment.commission.amount).toBeGreaterThan(0);
    });

    test('should require essential fields', async () => {
      const booking = new Booking({});
      await expect(booking.save()).rejects.toThrow();
    });

    test('should validate service type', async () => {
      const invalidData = {
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id,
        serviceDetails: {
          ...validBookingData.serviceDetails,
          type: 'invalid_service'
        }
      };

      const booking = new Booking(invalidData);
      await expect(booking.save()).rejects.toThrow();
    });

    test('should validate location coordinates', async () => {
      const invalidData = {
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id,
        location: {
          ...validBookingData.location,
          latitude: 91 // Invalid latitude
        }
      };

      const booking = new Booking(invalidData);
      await expect(booking.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    test('calculateCommission should calculate correct commission', () => {
      const booking = new Booking({
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      });

      const commission = booking.calculateCommission();
      expect(commission).toBe(500); // 10% of 5000
      expect(booking.payment.commission.amount).toBe(500);
      expect(booking.payment.commission.rate).toBe(0.1);
    });

    test('updateStatus should validate status transitions', async () => {
      const booking = new Booking({
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      });

      // Valid transition
      booking.updateStatus('confirmed');
      expect(booking.status).toBe('confirmed');

      // Invalid transition
      expect(() => {
        booking.updateStatus('completed'); // Can't go from confirmed to completed directly
      }).toThrow();
    });

    test('addRating should add rating to completed booking', async () => {
      const booking = new Booking({
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id,
        status: 'completed'
      });

      booking.addRating(5, 'Excellent work!');
      
      expect(booking.rating.score).toBe(5);
      expect(booking.rating.review).toBe('Excellent work!');
      expect(booking.rating.ratedAt).toBeInstanceOf(Date);
    });

    test('addRating should throw error for non-completed booking', () => {
      const booking = new Booking({
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id,
        status: 'pending'
      });

      expect(() => {
        booking.addRating(5, 'Great!');
      }).toThrow();
    });
  });

  describe('Static Methods', () => {
    test('findByUser should find bookings for user', async () => {
      await new Booking({
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      }).save();

      const userBookings = await Booking.findByUser(testUser._id);
      expect(userBookings.length).toBe(1);
      expect(userBookings[0].userId.toString()).toBe(testUser._id.toString());
    });

    test('findByArtisan should find bookings for artisan', async () => {
      await new Booking({
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      }).save();

      const artisanBookings = await Booking.findByArtisan(testArtisan._id);
      expect(artisanBookings.length).toBe(1);
      expect(artisanBookings[0].artisanId.toString()).toBe(testArtisan._id.toString());
    });

    test('should filter bookings by status', async () => {
      await new Booking({
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id,
        status: 'confirmed'
      }).save();

      const confirmedBookings = await Booking.findByUser(testUser._id, 'confirmed');
      expect(confirmedBookings.length).toBe(1);

      const pendingBookings = await Booking.findByUser(testUser._id, 'pending');
      expect(pendingBookings.length).toBe(0);
    });
  });

  describe('Virtuals', () => {
    test('referenceNumber should generate correct format', () => {
      const booking = new Booking({
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      });

      expect(booking.referenceNumber).toMatch(/^BK[A-Z0-9]{8}$/);
    });

    test('totalCost should include commission', () => {
      const booking = new Booking({
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      });

      booking.calculateCommission();
      expect(booking.totalCost).toBe(5500); // 5000 + 500 commission
    });
  });

  describe('Pre-save Middleware', () => {
    test('should automatically calculate commission on save', async () => {
      const booking = new Booking({
        ...validBookingData,
        userId: testUser._id,
        artisanId: testArtisan._id
      });

      const savedBooking = await booking.save();
      expect(savedBooking.payment.commission.amount).toBe(500);
    });
  });
});