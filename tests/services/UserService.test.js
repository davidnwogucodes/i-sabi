const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const UserService = require('../../src/services/UserService');
const User = require('../../src/models/User');

describe('UserService', () => {
  let mongoServer;
  let userService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    userService = new UserService();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  const mockTelegramUser = {
    id: 123456789,
    first_name: 'John',
    last_name: 'Doe',
    username: 'johndoe'
  };

  describe('createUser', () => {
    test('should create a new user', async () => {
      const user = await userService.createUser(mockTelegramUser);
      
      expect(user).toBeTruthy();
      expect(user.telegramId).toBe(123456789);
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.username).toBe('johndoe');
    });

    test('should update existing user', async () => {
      // Create initial user
      await userService.createUser(mockTelegramUser);
      
      // Update with new data
      const updatedTelegramUser = {
        ...mockTelegramUser,
        first_name: 'Johnny'
      };
      
      const user = await userService.createUser(updatedTelegramUser);
      expect(user.firstName).toBe('Johnny');
      
      // Should still be only one user
      const userCount = await User.countDocuments();
      expect(userCount).toBe(1);
    });

    test('should throw error for missing required fields', async () => {
      await expect(userService.createUser({})).rejects.toThrow('Missing required parameters');
    });
  });

  describe('getUserProfile', () => {
    test('should get user by telegram ID', async () => {
      await userService.createUser(mockTelegramUser);
      
      const user = await userService.getUserProfile(123456789);
      expect(user).toBeTruthy();
      expect(user.telegramId).toBe(123456789);
    });

    test('should return null for non-existent user', async () => {
      const user = await userService.getUserProfile(999999999);
      expect(user).toBeNull();
    });
  });

  describe('updateUserLocation', () => {
    test('should update user location', async () => {
      await userService.createUser(mockTelegramUser);
      
      const location = {
        latitude: 6.5244,
        longitude: 3.3792,
        address: 'Lagos, Nigeria'
      };
      
      const user = await userService.updateUserLocation(123456789, location);
      expect(user.location.latitude).toBe(6.5244);
      expect(user.location.longitude).toBe(3.3792);
      expect(user.location.address).toBe('Lagos, Nigeria');
    });

    test('should throw error for invalid coordinates', async () => {
      await userService.createUser(mockTelegramUser);
      
      const invalidLocation = {
        latitude: 91, // Invalid
        longitude: 3.3792
      };
      
      await expect(userService.updateUserLocation(123456789, invalidLocation))
        .rejects.toThrow('Invalid coordinates');
    });

    test('should throw error for non-existent user', async () => {
      const location = {
        latitude: 6.5244,
        longitude: 3.3792
      };
      
      await expect(userService.updateUserLocation(999999999, location))
        .rejects.toThrow('User not found');
    });
  });

  describe('updateUserPreferences', () => {
    test('should update user preferences', async () => {
      await userService.createUser(mockTelegramUser);
      
      const preferences = {
        serviceTypes: ['plumbing', 'electrical'],
        maxDistance: 20
      };
      
      const user = await userService.updateUserPreferences(123456789, preferences);
      expect(user.preferences.serviceTypes).toEqual(['plumbing', 'electrical']);
      expect(user.preferences.maxDistance).toBe(20);
    });
  });

  describe('hasUserLocation', () => {
    test('should return true when user has location', async () => {
      const user = await userService.createUser(mockTelegramUser);
      await userService.updateUserLocation(123456789, {
        latitude: 6.5244,
        longitude: 3.3792
      });
      
      const hasLocation = await userService.hasUserLocation(123456789);
      expect(hasLocation).toBe(true);
    });

    test('should return false when user has no location', async () => {
      await userService.createUser(mockTelegramUser);
      
      const hasLocation = await userService.hasUserLocation(123456789);
      expect(hasLocation).toBe(false);
    });

    test('should return false for non-existent user', async () => {
      const hasLocation = await userService.hasUserLocation(999999999);
      expect(hasLocation).toBe(false);
    });
  });

  describe('getUserStats', () => {
    test('should return user statistics', async () => {
      await userService.createUser(mockTelegramUser);
      
      const stats = await userService.getUserStats(123456789);
      expect(stats).toHaveProperty('totalBookings');
      expect(stats).toHaveProperty('completedBookings');
      expect(stats).toHaveProperty('totalSpent');
      expect(stats).toHaveProperty('memberSince');
      expect(stats.totalBookings).toBe(0);
    });
  });

  describe('error handling', () => {
    test('should handle invalid ObjectId', async () => {
      await expect(userService.getUserById('invalid-id'))
        .rejects.toThrow('Invalid user ID format');
    });

    test('should handle missing parameters', async () => {
      await expect(userService.getUserProfile())
        .rejects.toThrow('Missing required parameters');
    });
  });
});