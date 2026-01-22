const BaseService = require('./BaseService');
const Artisan = require('../models/Artisan');
const { validateObjectId, validateCoordinates, validateServiceType, validateTier } = require('../config/database');

class ArtisanService extends BaseService {
  constructor() {
    super('ArtisanService');
  }

  /**
   * Register a new artisan
   * @param {Object} artisanData - Artisan registration data
   * @returns {Promise<Object>} - Created artisan
   */
  async registerArtisan(artisanData) {
    return this.executeOperation('registerArtisan', async () => {
      this.validateRequired(artisanData, ['telegramId', 'personalInfo', 'businessInfo', 'location', 'bankDetails']);
      this.validateRequired(artisanData.personalInfo, ['firstName', 'lastName', 'phone']);
      this.validateRequired(artisanData.businessInfo, ['serviceTypes', 'yearsExperience']);
      this.validateRequired(artisanData.location, ['latitude', 'longitude', 'address']);
      this.validateRequired(artisanData.bankDetails, ['accountName', 'accountNumber', 'bankName']);

      // Validate coordinates
      if (!validateCoordinates(artisanData.location.latitude, artisanData.location.longitude)) {
        throw new Error('Invalid coordinates provided');
      }

      // Validate service types
      artisanData.businessInfo.serviceTypes.forEach(serviceType => {
        if (!validateServiceType(serviceType)) {
          throw new Error(`Invalid service type: ${serviceType}`);
        }
      });

      // Check if artisan already exists
      const existingArtisan = await Artisan.findByTelegramId(artisanData.telegramId);
      if (existingArtisan) {
        throw new Error('Artisan already registered with this Telegram ID');
      }

      const artisan = new Artisan(artisanData);
      return await artisan.save();
    }, { telegramId: artisanData.telegramId });
  }

  /**
   * Get artisan profile by Telegram ID
   * @param {number} telegramId - Telegram user ID
   * @returns {Promise<Object|null>} - Artisan profile or null
   */
  async getArtisanProfile(telegramId) {
    return this.executeOperation('getArtisanProfile', async () => {
      this.validateRequired({ telegramId }, ['telegramId']);
      return await Artisan.findByTelegramId(telegramId);
    }, { telegramId });
  }

  /**
   * Get artisan by MongoDB ObjectId
   * @param {string} artisanId - MongoDB ObjectId
   * @returns {Promise<Object|null>} - Artisan profile or null
   */
  async getArtisanById(artisanId) {
    return this.executeOperation('getArtisanById', async () => {
      this.validateRequired({ artisanId }, ['artisanId']);
      
      if (!validateObjectId(artisanId)) {
        throw new Error('Invalid artisan ID format');
      }

      return await Artisan.findById(artisanId);
    }, { artisanId });
  }

  /**
   * Find nearby artisans
   * @param {number} latitude - User's latitude
   * @param {number} longitude - User's longitude
   * @param {string} serviceType - Required service type
   * @param {number} maxDistance - Maximum distance in kilometers
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} - Array of nearby artisans
   */
  async findNearbyArtisans(latitude, longitude, serviceType = null, maxDistance = 15, limit = 10) {
    return this.executeOperation('findNearbyArtisans', async () => {
      this.validateRequired({ latitude, longitude }, ['latitude', 'longitude']);

      if (!validateCoordinates(latitude, longitude)) {
        throw new Error('Invalid coordinates provided');
      }

      if (serviceType && !validateServiceType(serviceType)) {
        throw new Error(`Invalid service type: ${serviceType}`);
      }

      const artisans = await Artisan.findNearby(latitude, longitude, maxDistance, serviceType)
        .limit(limit)
        .select('-bankDetails -verification.verificationDocuments'); // Exclude sensitive data

      return artisans;
    }, { latitude, longitude, serviceType, maxDistance, limit });
  }

  /**
   * Evaluate and update artisan tier
   * @param {string} artisanId - Artisan ObjectId
   * @returns {Promise<Object>} - Updated artisan with new tier
   */
  async evaluateArtisanTier(artisanId) {
    return this.executeOperation('evaluateArtisanTier', async () => {
      this.validateRequired({ artisanId }, ['artisanId']);

      if (!validateObjectId(artisanId)) {
        throw new Error('Invalid artisan ID format');
      }

      const artisan = await Artisan.findById(artisanId);
      if (!artisan) {
        throw new Error('Artisan not found');
      }

      const newTier = artisan.updateTier();
      await artisan.save();

      this.logOperation('tierUpdated', { 
        artisanId, 
        oldTier: artisan.tier.current, 
        newTier, 
        score: artisan.tier.score 
      });

      return artisan;
    }, { artisanId });
  }

  /**
   * Update artisan availability
   * @param {string} artisanId - Artisan ObjectId
   * @param {Object} schedule - Availability schedule
   * @param {boolean} isActive - Whether artisan is currently active
   * @returns {Promise<Object>} - Updated artisan
   */
  async updateArtisanAvailability(artisanId, schedule, isActive = true) {
    return this.executeOperation('updateArtisanAvailability', async () => {
      this.validateRequired({ artisanId }, ['artisanId']);

      if (!validateObjectId(artisanId)) {
        throw new Error('Invalid artisan ID format');
      }

      const artisan = await Artisan.findById(artisanId);
      if (!artisan) {
        throw new Error('Artisan not found');
      }

      if (schedule) {
        artisan.availability.schedule = schedule;
      }
      
      artisan.availability.isActive = isActive;
      artisan.availability.lastActive = new Date();

      return await artisan.save();
    }, { artisanId, isActive });
  }

  /**
   * Get artisan portfolio for web display
   * @param {string} artisanId - Artisan ObjectId
   * @returns {Promise<Object>} - Artisan portfolio data
   */
  async getArtisanPortfolio(artisanId) {
    return this.executeOperation('getArtisanPortfolio', async () => {
      this.validateRequired({ artisanId }, ['artisanId']);

      if (!validateObjectId(artisanId)) {
        throw new Error('Invalid artisan ID format');
      }

      const artisan = await Artisan.findById(artisanId)
        .select('-bankDetails -verification.verificationDocuments -telegramId'); // Exclude sensitive data

      if (!artisan) {
        throw new Error('Artisan not found');
      }

      return {
        id: artisan._id,
        name: artisan.fullName,
        businessName: artisan.businessInfo.businessName,
        serviceTypes: artisan.businessInfo.serviceTypes,
        yearsExperience: artisan.businessInfo.yearsExperience,
        tier: artisan.tier.current,
        rating: artisan.metrics.averageRating,
        totalJobs: artisan.metrics.totalJobs,
        completionRate: artisan.metrics.completionRate,
        portfolio: artisan.topPortfolio,
        location: {
          address: artisan.location.address,
          serviceRadius: artisan.location.serviceRadius
        }
      };
    }, { artisanId });
  }

  /**
   * Update artisan metrics after job completion
   * @param {string} artisanId - Artisan ObjectId
   * @param {Object} jobData - Job completion data
   * @returns {Promise<Object>} - Updated artisan
   */
  async updateArtisanMetrics(artisanId, jobData) {
    return this.executeOperation('updateArtisanMetrics', async () => {
      this.validateRequired({ artisanId, jobData }, ['artisanId', 'jobData']);
      this.validateRequired(jobData, ['completed', 'rating', 'earnings']);

      if (!validateObjectId(artisanId)) {
        throw new Error('Invalid artisan ID format');
      }

      const artisan = await Artisan.findById(artisanId);
      if (!artisan) {
        throw new Error('Artisan not found');
      }

      // Update metrics
      artisan.metrics.totalJobs += 1;
      
      if (jobData.completed) {
        const completedJobs = artisan.metrics.totalJobs * (artisan.metrics.completionRate / 100);
        artisan.metrics.completionRate = ((completedJobs + 1) / artisan.metrics.totalJobs) * 100;
      }

      if (jobData.rating) {
        const totalRating = artisan.metrics.averageRating * (artisan.metrics.totalJobs - 1);
        artisan.metrics.averageRating = (totalRating + jobData.rating) / artisan.metrics.totalJobs;
      }

      if (jobData.earnings) {
        artisan.metrics.totalEarnings += jobData.earnings;
      }

      await artisan.save();

      // Re-evaluate tier after metrics update
      return await this.evaluateArtisanTier(artisanId);
    }, { artisanId, jobData });
  }

  /**
   * Add portfolio item
   * @param {string} artisanId - Artisan ObjectId
   * @param {Object} portfolioItem - Portfolio item data
   * @returns {Promise<Object>} - Updated artisan
   */
  async addPortfolioItem(artisanId, portfolioItem) {
    return this.executeOperation('addPortfolioItem', async () => {
      this.validateRequired({ artisanId, portfolioItem }, ['artisanId', 'portfolioItem']);
      this.validateRequired(portfolioItem, ['title', 'description', 'projectScale', 'clientType', 'completedDate']);

      if (!validateObjectId(artisanId)) {
        throw new Error('Invalid artisan ID format');
      }

      const artisan = await Artisan.findById(artisanId);
      if (!artisan) {
        throw new Error('Artisan not found');
      }

      artisan.portfolio.push(portfolioItem);
      return await artisan.save();
    }, { artisanId, portfolioItem });
  }

  /**
   * Get artisan statistics and analytics
   * @param {string} artisanId - Artisan ObjectId
   * @returns {Promise<Object>} - Artisan statistics
   */
  async getArtisanStats(artisanId) {
    return this.executeOperation('getArtisanStats', async () => {
      this.validateRequired({ artisanId }, ['artisanId']);

      if (!validateObjectId(artisanId)) {
        throw new Error('Invalid artisan ID format');
      }

      const artisan = await Artisan.findById(artisanId);
      if (!artisan) {
        throw new Error('Artisan not found');
      }

      return {
        tier: {
          current: artisan.tier.current,
          score: artisan.tier.score,
          lastEvaluated: artisan.tier.lastEvaluated
        },
        metrics: artisan.metrics,
        portfolio: {
          totalItems: artisan.portfolio.length,
          recentItems: artisan.portfolio.slice(-3)
        },
        memberSince: artisan.createdAt,
        isActive: artisan.availability.isActive,
        lastActive: artisan.availability.lastActive,
        serviceTypes: artisan.businessInfo.serviceTypes,
        serviceRadius: artisan.location.serviceRadius
      };
    }, { artisanId });
  }

  /**
   * Search artisans by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} - Array of matching artisans
   */
  async searchArtisans(criteria) {
    return this.executeOperation('searchArtisans', async () => {
      const query = { 'availability.isActive': true };

      if (criteria.serviceType) {
        if (!validateServiceType(criteria.serviceType)) {
          throw new Error(`Invalid service type: ${criteria.serviceType}`);
        }
        query['businessInfo.serviceTypes'] = criteria.serviceType;
      }

      if (criteria.tier) {
        if (!validateTier(criteria.tier)) {
          throw new Error(`Invalid tier: ${criteria.tier}`);
        }
        query['tier.current'] = criteria.tier;
      }

      if (criteria.minRating) {
        query['metrics.averageRating'] = { $gte: criteria.minRating };
      }

      if (criteria.minExperience) {
        query['businessInfo.yearsExperience'] = { $gte: criteria.minExperience };
      }

      const artisans = await Artisan.find(query)
        .select('-bankDetails -verification.verificationDocuments')
        .sort({ 'metrics.averageRating': -1, 'tier.score': -1 })
        .limit(criteria.limit || 20);

      return artisans;
    }, { criteria });
  }
}

module.exports = ArtisanService;