const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  username: {
    type: String,
    trim: true,
    lowercase: true
  },
  location: {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    },
    address: {
      type: String,
      trim: true
    }
  },
  bookingHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }],
  preferences: {
    serviceTypes: [{
      type: String,
      enum: ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting', 'hvac', 'landscaping', 'other']
    }],
    maxDistance: {
      type: Number,
      default: 10, // kilometers
      min: 1,
      max: 100
    },
    preferredTiers: [{
      type: String,
      enum: ['Foundation', 'Professional', 'Elite']
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName}${this.lastName ? ' ' + this.lastName : ''}`;
});

// Method to check if user has location set
userSchema.methods.hasLocation = function() {
  return this.location && this.location.latitude && this.location.longitude;
};

// Static method to find user by telegram ID
userSchema.statics.findByTelegramId = function(telegramId) {
  return this.findOne({ telegramId });
};

module.exports = mongoose.model('User', userSchema);