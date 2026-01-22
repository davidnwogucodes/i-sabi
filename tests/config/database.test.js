const {
  validateObjectId,
  validateCoordinates,
  validateServiceType,
  validateTier,
  validateBookingStatus
} = require('../../src/config/database');
const mongoose = require('mongoose');

describe('Database Validation Utilities', () => {
  describe('validateObjectId', () => {
    test('should validate correct ObjectId', () => {
      const validId = new mongoose.Types.ObjectId();
      expect(validateObjectId(validId)).toBe(true);
      expect(validateObjectId(validId.toString())).toBe(true);
    });

    test('should reject invalid ObjectId', () => {
      expect(validateObjectId('invalid')).toBe(false);
      expect(validateObjectId('123')).toBe(false);
      expect(validateObjectId(null)).toBe(false);
      expect(validateObjectId(undefined)).toBe(false);
    });
  });

  describe('validateCoordinates', () => {
    test('should validate correct coordinates', () => {
      expect(validateCoordinates(6.5244, 3.3792)).toBe(true);
      expect(validateCoordinates(0, 0)).toBe(true);
      expect(validateCoordinates(-90, -180)).toBe(true);
      expect(validateCoordinates(90, 180)).toBe(true);
    });

    test('should reject invalid coordinates', () => {
      expect(validateCoordinates(91, 0)).toBe(false); // Invalid latitude
      expect(validateCoordinates(0, 181)).toBe(false); // Invalid longitude
      expect(validateCoordinates(-91, 0)).toBe(false); // Invalid latitude
      expect(validateCoordinates(0, -181)).toBe(false); // Invalid longitude
      expect(validateCoordinates('6.5244', '3.3792')).toBe(false); // String coordinates
      expect(validateCoordinates(null, null)).toBe(false);
    });
  });

  describe('validateServiceType', () => {
    test('should validate correct service types', () => {
      const validTypes = ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting', 'hvac', 'landscaping', 'other'];
      
      validTypes.forEach(type => {
        expect(validateServiceType(type)).toBe(true);
      });
    });

    test('should reject invalid service types', () => {
      expect(validateServiceType('invalid')).toBe(false);
      expect(validateServiceType('PLUMBING')).toBe(false); // Case sensitive
      expect(validateServiceType('')).toBe(false);
      expect(validateServiceType(null)).toBe(false);
      expect(validateServiceType(undefined)).toBe(false);
    });
  });

  describe('validateTier', () => {
    test('should validate correct tiers', () => {
      expect(validateTier('Foundation')).toBe(true);
      expect(validateTier('Professional')).toBe(true);
      expect(validateTier('Elite')).toBe(true);
    });

    test('should reject invalid tiers', () => {
      expect(validateTier('foundation')).toBe(false); // Case sensitive
      expect(validateTier('Basic')).toBe(false);
      expect(validateTier('Premium')).toBe(false);
      expect(validateTier('')).toBe(false);
      expect(validateTier(null)).toBe(false);
    });
  });

  describe('validateBookingStatus', () => {
    test('should validate correct booking statuses', () => {
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed'];
      
      validStatuses.forEach(status => {
        expect(validateBookingStatus(status)).toBe(true);
      });
    });

    test('should reject invalid booking statuses', () => {
      expect(validateBookingStatus('active')).toBe(false);
      expect(validateBookingStatus('PENDING')).toBe(false); // Case sensitive
      expect(validateBookingStatus('finished')).toBe(false);
      expect(validateBookingStatus('')).toBe(false);
      expect(validateBookingStatus(null)).toBe(false);
    });
  });
});