const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Artisan = require('../../src/models/Artisan');

describe('Artisan Model', () => {
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
    await Artisan.deleteMany({});
  });

  const validArtisanData = {
    telegramId: 123456789,
    personalInfo: {
      firstName: 'John',
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
      accountName: 'John Smith',
      accountNumber: '1234567890',
      bankName: 'First Bank'
    }
  };

  describe('Schema Validation', () => {
    test('should create a valid artisan', async () => {
      const artisan = new Artisan(validArtisanData);
      const savedArtisan = await artisan.save();

      expect(savedArtisan._id).toBeDefined();
      expect(savedArtisan.telegramId).toBe(123456789);
      expect(savedArtisan.tier.current).toBe('Foundation');
      expect(savedArtisan.fullName).toBe('John Smith');
    });

    test('should require essential fields', async () => {
      const artisan = new Artisan({});
      await expect(artisan.save()).rejects.toThrow();
    });

    test('should enforce unique telegramId', async () => {
      await new Artisan(validArtisanData).save();
      
      const duplicateArtisan = new Artisan(validArtisanData);
      await expect(duplicateArtisan.save()).rejects.toThrow();
    });

    test('should validate service types', async () => {
      const invalidData = {
        ...validArtisanData,
        businessInfo: {
          ...validArtisanData.businessInfo,
          serviceTypes: ['invalid_service']
        }
      };

      const artisan = new Artisan(invalidData);
      await expect(artisan.save()).rejects.toThrow();
    });

    test('should validate years of experience range', async () => {
      const invalidData = {
        ...validArtisanData,
        businessInfo: {
          ...validArtisanData.businessInfo,
          yearsExperience: -1
        }
      };

      const artisan = new Artisan(invalidData);
      await expect(artisan.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    test('calculateTierScore should return correct score', () => {
      const artisan = new Artisan({
        ...validArtisanData,
        businessInfo: {
          ...validArtisanData.businessInfo,
          yearsExperience: 10
        },
        metrics: {
          completionRate: 95,
          averageRating: 4.5,
          totalJobs: 50
        },
        portfolio: [
          { projectScale: 'large', completedDate: new Date() },
          { projectScale: 'medium', completedDate: new Date() }
        ]
      });

      const score = artisan.calculateTierScore();
      expect(score).toBeGreaterThan(0);
      expect(typeof score).toBe('number');
    });

    test('updateTier should set correct tier based on score', () => {
      const artisan = new Artisan({
        ...validArtisanData,
        businessInfo: {
          ...validArtisanData.businessInfo,
          yearsExperience: 15
        },
        metrics: {
          completionRate: 98,
          averageRating: 4.8,
          totalJobs: 100
        }
      });

      const tier = artisan.updateTier();
      expect(['Foundation', 'Professional', 'Elite']).toContain(tier);
      expect(artisan.tier.current).toBe(tier);
      expect(artisan.tier.lastEvaluated).toBeInstanceOf(Date);
    });
  });

  describe('Static Methods', () => {
    test('findByTelegramId should find artisan by telegram ID', async () => {
      await new Artisan(validArtisanData).save();
      
      const foundArtisan = await Artisan.findByTelegramId(123456789);
      expect(foundArtisan).toBeTruthy();
      expect(foundArtisan.personalInfo.firstName).toBe('John');
    });

    test('findNearby should find artisans within distance', async () => {
      // Create test artisans
      await new Artisan(validArtisanData).save();
      
      const nearbyArtisans = await Artisan.findNearby(6.5244, 3.3792, 20);
      expect(nearbyArtisans.length).toBeGreaterThan(0);
    });

    test('findNearby should filter by service type', async () => {
      await new Artisan(validArtisanData).save();
      
      const plumbers = await Artisan.findNearby(6.5244, 3.3792, 20, 'plumbing');
      expect(plumbers.length).toBeGreaterThan(0);
      
      const electricians = await Artisan.findNearby(6.5244, 3.3792, 20, 'electrical');
      expect(electricians.length).toBe(0);
    });
  });

  describe('Virtuals', () => {
    test('fullName should combine first and last name', () => {
      const artisan = new Artisan(validArtisanData);
      expect(artisan.fullName).toBe('John Smith');
    });

    test('topPortfolio should return top 5 portfolio items', () => {
      const artisan = new Artisan({
        ...validArtisanData,
        portfolio: Array.from({ length: 10 }, (_, i) => ({
          title: `Project ${i}`,
          description: 'Test project',
          projectScale: 'medium',
          clientType: 'residential',
          completedDate: new Date(2023, 0, i + 1)
        }))
      });

      const topPortfolio = artisan.topPortfolio;
      expect(topPortfolio.length).toBe(5);
      expect(topPortfolio[0].completedDate.getTime()).toBeGreaterThan(topPortfolio[4].completedDate.getTime());
    });
  });
});