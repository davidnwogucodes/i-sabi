const mongoose = require('mongoose');

const artisanSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  personalInfo: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    }
  },
  businessInfo: {
    businessName: {
      type: String,
      trim: true
    },
    serviceTypes: [{
      type: String,
      required: true,
      enum: ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting', 'hvac', 'landscaping', 'other']
    }],
    yearsExperience: {
      type: Number,
      required: true,
      min: 0,
      max: 50
    },
    certifications: [{
      name: String,
      issuer: String,
      dateIssued: Date,
      expiryDate: Date,
      verified: {
        type: Boolean,
        default: false
      }
    }]
  },
  location: {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    serviceRadius: {
      type: Number,
      default: 15, // kilometers
      min: 1,
      max: 100
    },
    address: {
      type: String,
      required: true,
      trim: true
    }
  },
  tier: {
    current: {
      type: String,
      enum: ['Foundation', 'Professional', 'Elite'],
      default: 'Foundation'
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    lastEvaluated: {
      type: Date,
      default: Date.now
    }
  },
  portfolio: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    images: [{
      url: String,
      caption: String
    }],
    projectScale: {
      type: String,
      enum: ['small', 'medium', 'large'],
      required: true
    },
    clientType: {
      type: String,
      enum: ['residential', 'commercial', 'industrial', 'government'],
      required: true
    },
    completedDate: {
      type: Date,
      required: true
    },
    cost: {
      type: Number,
      min: 0
    }
  }],
  metrics: {
    totalJobs: {
      type: Number,
      default: 0,
      min: 0
    },
    completionRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0
    },
    responseTime: {
      type: Number,
      default: 24, // hours
      min: 0
    }
  },
  availability: {
    schedule: {
      type: Map,
      of: [{
        start: String, // "09:00"
        end: String,   // "17:00"
        available: Boolean
      }]
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastActive: {
      type: Date,
      default: Date.now
    }
  },
  bankDetails: {
    accountName: {
      type: String,
      required: true,
      trim: true
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true
    },
    bankName: {
      type: String,
      required: true,
      trim: true
    },
    routingCode: {
      type: String,
      trim: true
    }
  },
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    verificationDocuments: [{
      type: String,
      url: String,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      }
    }]
  },
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'professional', 'elite'],
      default: 'basic'
    },
    startDate: Date,
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
artisanSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
artisanSchema.index({ 'businessInfo.serviceTypes': 1 });
artisanSchema.index({ 'tier.current': 1 });
artisanSchema.index({ 'metrics.averageRating': -1 });

// Virtual for full name
artisanSchema.virtual('fullName').get(function() {
  return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

// Virtual for top portfolio items
artisanSchema.virtual('topPortfolio').get(function() {
  return this.portfolio
    .sort((a, b) => b.completedDate - a.completedDate)
    .slice(0, 5);
});

// Method to calculate tier score
artisanSchema.methods.calculateTierScore = function() {
  const metrics = {
    experience: this.businessInfo.yearsExperience * 10,
    projectScale: this.portfolio.filter(p => p.projectScale === 'large').length * 5,
    successRate: this.metrics.completionRate * 0.2,
    ratings: this.metrics.averageRating * 15,
    portfolioQuality: Math.min(this.portfolio.length * 2, 20),
    totalJobs: Math.min(this.metrics.totalJobs * 0.5, 15)
  };
  
  return Object.values(metrics).reduce((sum, value) => sum + value, 0);
};

// Method to update tier based on score
artisanSchema.methods.updateTier = function() {
  const score = this.calculateTierScore();
  this.tier.score = score;
  
  if (score >= 80) {
    this.tier.current = 'Elite';
  } else if (score >= 50) {
    this.tier.current = 'Professional';
  } else {
    this.tier.current = 'Foundation';
  }
  
  this.tier.lastEvaluated = new Date();
  return this.tier.current;
};

// Static method to find nearby artisans
artisanSchema.statics.findNearby = function(latitude, longitude, maxDistance = 15, serviceType = null) {
  const query = {
    'location.latitude': {
      $gte: latitude - (maxDistance / 111), // Rough conversion: 1 degree ≈ 111km
      $lte: latitude + (maxDistance / 111)
    },
    'location.longitude': {
      $gte: longitude - (maxDistance / (111 * Math.cos(latitude * Math.PI / 180))),
      $lte: longitude + (maxDistance / (111 * Math.cos(latitude * Math.PI / 180)))
    },
    'availability.isActive': true
  };
  
  if (serviceType) {
    query['businessInfo.serviceTypes'] = serviceType;
  }
  
  return this.find(query).sort({ 'metrics.averageRating': -1, 'tier.score': -1 });
};

// Static method to find by telegram ID
artisanSchema.statics.findByTelegramId = function(telegramId) {
  return this.findOne({ telegramId });
};

module.exports = mongoose.model('Artisan', artisanSchema);