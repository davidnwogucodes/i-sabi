const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  artisanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artisan',
    required: true
  },
  serviceDetails: {
    type: {
      type: String,
      required: true,
      enum: ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting', 'hvac', 'landscaping', 'other']
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'emergency'],
      default: 'medium'
    },
    estimatedDuration: {
      type: Number, // hours
      min: 0.5,
      max: 168 // 1 week
    },
    estimatedCost: {
      type: Number,
      min: 0
    }
  },
  scheduling: {
    requestedDate: {
      type: Date,
      required: true
    },
    confirmedDate: {
      type: Date
    },
    completedDate: {
      type: Date
    },
    timeSlot: {
      start: String, // "09:00"
      end: String    // "12:00"
    }
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
    address: {
      type: String,
      required: true,
      trim: true
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  payment: {
    method: {
      type: String,
      enum: ['bank_transfer'],
      default: 'bank_transfer'
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'NGN'
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'disputed', 'refunded'],
      default: 'pending'
    },
    transferReference: {
      type: String,
      trim: true
    },
    paidAt: Date,
    commission: {
      rate: {
        type: Number,
        default: 0.1, // 10%
        min: 0,
        max: 1
      },
      amount: Number
    }
  },
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    review: {
      type: String,
      trim: true,
      maxlength: 500
    },
    ratedAt: Date
  },
  communication: [{
    from: {
      type: String,
      enum: ['user', 'artisan', 'system'],
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'location', 'system_notification'],
      default: 'text'
    }
  }],
  cancellation: {
    cancelledBy: {
      type: String,
      enum: ['user', 'artisan', 'system']
    },
    reason: {
      type: String,
      trim: true
    },
    cancelledAt: Date,
    refundAmount: Number
  }
}, {
  timestamps: true
});

// Indexes for performance
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ artisanId: 1, status: 1 });
bookingSchema.index({ 'scheduling.requestedDate': 1 });
bookingSchema.index({ 'scheduling.confirmedDate': 1 });
bookingSchema.index({ status: 1, createdAt: -1 });

// Virtual for booking reference number
bookingSchema.virtual('referenceNumber').get(function() {
  return `BK${this._id.toString().slice(-8).toUpperCase()}`;
});

// Virtual for total cost including commission
bookingSchema.virtual('totalCost').get(function() {
  const commission = this.payment.amount * (this.payment.commission?.rate || 0.1);
  return this.payment.amount + commission;
});

// Method to calculate commission
bookingSchema.methods.calculateCommission = function() {
  const rate = this.payment.commission?.rate || 0.1;
  const commission = this.payment.amount * rate;
  this.payment.commission = {
    rate,
    amount: commission
  };
  return commission;
};

// Method to update status with validation
bookingSchema.methods.updateStatus = function(newStatus, reason = null) {
  const validTransitions = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['in_progress', 'cancelled'],
    'in_progress': ['completed', 'cancelled'],
    'completed': ['disputed'],
    'cancelled': [],
    'disputed': ['completed', 'cancelled']
  };
  
  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus;
  
  if (newStatus === 'cancelled') {
    this.cancellation = {
      cancelledBy: 'system',
      reason: reason || 'Status updated to cancelled',
      cancelledAt: new Date()
    };
  }
  
  // Add system communication log
  this.communication.push({
    from: 'system',
    message: `Booking status updated to ${newStatus}${reason ? ': ' + reason : ''}`,
    messageType: 'system_notification'
  });
  
  return this;
};

// Method to add rating
bookingSchema.methods.addRating = function(score, review = null) {
  if (this.status !== 'completed') {
    throw new Error('Can only rate completed bookings');
  }
  
  this.rating = {
    score,
    review,
    ratedAt: new Date()
  };
  
  return this;
};

// Static method to find bookings by user
bookingSchema.statics.findByUser = function(userId, status = null) {
  const query = { userId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 }).populate('artisanId', 'personalInfo businessInfo tier');
};

// Static method to find bookings by artisan
bookingSchema.statics.findByArtisan = function(artisanId, status = null) {
  const query = { artisanId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 }).populate('userId', 'firstName lastName telegramId');
};

// Pre-save middleware to calculate commission
bookingSchema.pre('save', function(next) {
  if (this.isModified('payment.amount') && this.payment.amount > 0) {
    this.calculateCommission();
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);