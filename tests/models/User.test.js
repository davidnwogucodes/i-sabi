const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/models/User');

describe('User Model', () => {
  let mongoServer;

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
    await User.deleteMany({});
  });

  describe('Schema Validation', () => {
    test('should create a valid user', async () => {
      const userData = {
        telegramId: 123456789,
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        location: {
          latitude: 6.5244,
          longitude: 3.3792,
          address: 'Lagos, Nigeria'
        }
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.telegramId).toBe(123456789);
      expect(savedUser.firstName).toBe('John');
      expect(savedUser.fullName).toBe('John Doe');
      expect(savedUser.isActive).toBe(true);
    });

    test('should require telegramId and firstName', async () => {
      const user = new User({});
      
      await expect(user.save()).rejects.toThrow();
    });

    test('should enforce unique telegramId', async () => {
      const userData = {
        telegramId: 123456789,
        firstName: 'John'
      };

      await new User(userData).save();
      
      const duplicateUser = new User(userData);
      await expect(duplicateUser.save()).rejects.toThrow();
    });

    test('should validate location coordinates', async () => {
      const userData = {
        telegramId: 123456789,
        firstName: 'John',
        location: {
          latitude: 91, // Invalid latitude
          longitude: 3.3792
        }
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow();
    });

    test('should validate service types in preferences', async () => {
      const userData = {
        telegramId: 123456789,
        firstName: 'John',
        preferences: {
          serviceTypes: ['invalid_service']
        }
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    test('hasLocation should return true when coordinates are set', async () => {
      const user = new User({
        telegramId: 123456789,
        firstName: 'John',
        location: {
          latitude: 6.5244,
          longitude: 3.3792
        }
      });

      expect(user.hasLocation()).toBe(true);
    });

    test('hasLocation should return false when coordinates are not set', async () => {
      const user = new User({
        telegramId: 123456789,
        firstName: 'John'
      });

      expect(user.hasLocation()).toBe(false);
    });
  });

  describe('Static Methods', () => {
    test('findByTelegramId should find user by telegram ID', async () => {
      const userData = {
        telegramId: 123456789,
        firstName: 'John'
      };

      await new User(userData).save();
      
      const foundUser = await User.findByTelegramId(123456789);
      expect(foundUser).toBeTruthy();
      expect(foundUser.firstName).toBe('John');
    });

    test('findByTelegramId should return null for non-existent user', async () => {
      const foundUser = await User.findByTelegramId(999999999);
      expect(foundUser).toBeNull();
    });
  });

  describe('Virtuals', () => {
    test('fullName should combine first and last name', () => {
      const user = new User({
        telegramId: 123456789,
        firstName: 'John',
        lastName: 'Doe'
      });

      expect(user.fullName).toBe('John Doe');
    });

    test('fullName should work with only first name', () => {
      const user = new User({
        telegramId: 123456789,
        firstName: 'John'
      });

      expect(user.fullName).toBe('John');
    });
  });
});