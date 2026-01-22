const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ArtisanService = require('../../src/services/ArtisanService');
const Artisan = require('../../src/models/Artisan');

describe('ArtisanService', () => {
  let mongoServer;
  let artisanService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    artisanService = new ArtisanService();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Artisan.deleteMany({});
  });

  const mockArtisanData = {
    telegramId: 123456789,
    personalInfo: {
      firstName: 'John',
      lastName: 'Smith',
      phone: '+2348012345678',
      email: 'john@example.com'
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
      accountName: 'John Smith',
      accountNumber: '1234567890',
      bankName: 'First Bank'
    }
  };

  describe('registerArtisan', () => {
    test('should register a new artisan', async () => {
      const artisan = await artisanService.registerArtisan(mockArtisanData);
      
      expect(artisan).toBeTruthy();
      expect(artisan.telegramId).toBe(123456789);
      expect(artisan.personalInfo.firstName).toBe('John');
      expect(artisan.tier.current).toBe('Foundation');
    });

    test('should throw error for duplicate telegram ID', async () => {
      await artisanService.registerArtisan(mockArtisanData);
      
      await expect(artisanService.registerArtisan(mockArtisanData))
        .rejects.toThrow('Artisan already registered');
    });

    test('should throw error for invalid coordinates', async () => {
      const invalidData = {
        ...mockArtisanData,
        location: {
          ...mockArtisanData.location,
          latitude: 91 // Invalid
        }
      };
      
      await expect(artisanService.registerArtisan(invalidData))
        .rejects.toThrow('Invalid coordinates');
    });

    test('should throw error for invalid service type', async () => {
      const invalidData = {
        ...mockArtisanData,
        businessInfo: {
          ...mockArtisanData.businessInfo,
          serviceTypes: ['invalid_service']
        }
      };
      
      await expect(artisanService.registerArtisan(invalidData))
        .rejects.toThrow('Invalid service type');
    });
  });

  describe('getArtisanProfile', () => {
    test('should get artisan by telegram ID', async () => {
      await artisanService.registerArtisan(mockArtisanData);
      
      const artisan = await artisanService.getArtisanProfile(123456789);
      expect(artisan).toBeTruthy();
      expect(artisan.telegramId).toBe(123456789);
    });

    test('should return null for non-existent artisan', async () => {
      const artisan = await artisanService.getArtisanProfile(999999999);
      expect(artisan).toBeNull();
    });
  });

  describe('findNearbyArtisans', () => {
    test('should find nearby artisans', async () => {
      await artisanService.registerArtisan(mockArtisanData);
      
      const nearbyArtisans = await artisanService.findNearbyArtisans(6.5244, 3.3792);
      expect(nearbyArtisans.length).toBeGreaterThan(0);
      expect(nearbyArtisans[0].bankDetails).toBeUndefined(); // Should exclude sensitive data
    });

    test('should filter by service type', async () => {
      await artisanService.registerArtisan(mockArtisanData);
      
      const plumbers = await artisanService.findNearbyArtisans(6.5244, 3.3792, 'plumbing');
      expect(plumbers.length).toBeGreaterThan(0);
      
      const electricians = await artisanService.findNearbyArtisans(6.5244, 3.3792, 'electrical');
      expect(electricians.length).toBe(0);
    });

    test('should throw error for invalid coordinates', async () => {
      await expect(artisanService.findNearbyArtisans(91, 3.3792))
        .rejects.toThrow('Invalid coordinates');
    });

    test('should throw error for invalid service type', async () => {
      await expect(artisanService.findNearbyArtisans(6.5244, 3.3792, 'invalid_service'))
        .rejects.toThrow('Invalid service type');
    });
  });

  describe('evaluateArtisanTier', () => {
    test('should evaluate and update artisan tier', async () => {
      const artisan = await artisanService.registerArtisan(mockArtisanData);
      
      const updatedArtisan = await artisanService.evaluateArtisanTier(artisan._id);
      expect(updatedArtisan.tier.score).toBeGreaterThanOrEqual(0);
      expect(['Foundation', 'Professional', 'Elite']).toContain(updatedArtisan.tier.current);
    });

    test('should throw error for invalid artisan ID', async () => {
      await expect(artisanService.evaluateArtisanTier('invalid-id'))
        .rejects.toThrow('Invalid artisan ID format');
    });

    test('should throw error for non-existent artisan', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(artisanService.evaluateArtisanTier(fakeId))
        .rejects.toThrow('Artisan not found');
    });
  });

  describe('updateArtisanAvailability', () => {
    test('should update artisan availability', async () => {
      const artisan = await artisanService.registerArtisan(mockArtisanData);
      
      const schedule = {
        monday: [{ start: '09:00', end: '17:00', available: true }]
      };
      
      const updatedArtisan = await artisanService.updateArtisanAvailability(
        artisan._id, 
        schedule, 
        true
      );
      
      expect(updatedArtisan.availability.isActive).toBe(true);
      expect(updatedArtisan.availability.lastActive).toBeInstanceOf(Date);
    });
  });

  describe('getArtisanPortfolio', () => {
    test('should get artisan portfolio data', async () => {
      const artisan = await artisanService.registerArtisan(mockArtisanData);
      
      const portfolio = await artisanService.getArtisanPortfolio(artisan._id);
      expect(portfolio).toHaveProperty('id');
      expect(portfolio).toHaveProperty('name');
      expect(portfolio).toHaveProperty('tier');
      expect(portfolio).toHaveProperty('rating');
      expect(portfolio).toHaveProperty('portfolio');
      expect(portfolio.bankDetails).toBeUndefined(); // Should exclude sensitive data
      expect(portfolio.telegramId).toBeUndefined(); // Should exclude sensitive data
    });
  });

  describe('updateArtisanMetrics', () => {
    test('should update artisan metrics after job completion', async () => {
      const artisan = await artisanService.registerArtisan(mockArtisanData);
      
      const jobData = {
        completed: true,
        rating: 5,
        earnings: 10000
      };
      
      const updatedArtisan = await artisanService.updateArtisanMetrics(artisan._id, jobData);
      expect(updatedArtisan.metrics.totalJobs).toBe(1);
      expect(updatedArtisan.metrics.averageRating).toBe(5);
      expect(updatedArtisan.metrics.totalEarnings).toBe(10000);
    });
  });

  describe('addPortfolioItem', () => {
    test('should add portfolio item', async () => {
      const artisan = await artisanService.registerArtisan(mockArtisanData);
      
      const portfolioItem = {
        title: 'Kitchen Renovation',
        description: 'Complete kitchen plumbing renovation',
        projectScale: 'medium',
        clientType: 'residential',
        completedDate: new Date(),
        cost: 50000
      };
      
      const updatedArtisan = await artisanService.addPortfolioItem(artisan._id, portfolioItem);
      expect(updatedArtisan.portfolio.length).toBe(1);
      expect(updatedArtisan.portfolio[0].title).toBe('Kitchen Renovation');
    });
  });

  describe('searchArtisans', () => {
    test('should search artisans by criteria', async () => {
      await artisanService.registerArtisan(mockArtisanData);
      
      const criteria = {
        serviceType: 'plumbing',
        minRating: 0,
        limit: 10
      };
      
      const results = await artisanService.searchArtisans(criteria);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].businessInfo.serviceTypes).toContain('plumbing');
    });

    test('should throw error for invalid service type in search', async () => {
      const criteria = {
        serviceType: 'invalid_service'
      };
      
      await expect(artisanService.searchArtisans(criteria))
        .rejects.toThrow('Invalid service type');
    });
  });

  describe('error handling', () => {
    test('should handle missing required parameters', async () => {
      await expect(artisanService.registerArtisan({}))
        .rejects.toThrow('Missing required parameters');
    });

    test('should handle invalid ObjectId', async () => {
      await expect(artisanService.getArtisanById('invalid-id'))
        .rejects.toThrow('Invalid artisan ID format');
    });
  });
});