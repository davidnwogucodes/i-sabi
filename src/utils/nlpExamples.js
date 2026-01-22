/**
 * Example messages and expected parsing results for testing NLP service
 * These can be used for integration testing and validation
 */

const nlpTestExamples = {
  plumbing: [
    {
      message: "My kitchen sink is leaking water everywhere, need urgent help",
      expected: {
        serviceType: 'plumbing',
        urgency: 'high',
        description: expect.stringContaining('sink'),
        confidence: expect.any(Number)
      }
    },
    {
      message: "Toilet is blocked and overflowing, emergency!",
      expected: {
        serviceType: 'plumbing',
        urgency: 'emergency',
        description: expect.stringContaining('toilet'),
        confidence: expect.any(Number)
      }
    },
    {
      message: "Need someone to install new pipes in my bathroom",
      expected: {
        serviceType: 'plumbing',
        urgency: 'medium',
        description: expect.stringContaining('pipes'),
        confidence: expect.any(Number)
      }
    }
  ],

  electrical: [
    {
      message: "Power socket in my room is not working, sparking when I plug things",
      expected: {
        serviceType: 'electrical',
        urgency: 'high',
        description: expect.stringContaining('socket'),
        confidence: expect.any(Number)
      }
    },
    {
      message: "Want to install ceiling fan in living room",
      expected: {
        serviceType: 'electrical',
        urgency: 'low',
        description: expect.stringContaining('fan'),
        confidence: expect.any(Number)
      }
    },
    {
      message: "All lights went off suddenly, need electrician now",
      expected: {
        serviceType: 'electrical',
        urgency: 'emergency',
        description: expect.stringContaining('lights'),
        confidence: expect.any(Number)
      }
    }
  ],

  carpentry: [
    {
      message: "My wardrobe door is broken, can't close properly",
      expected: {
        serviceType: 'carpentry',
        urgency: 'medium',
        description: expect.stringContaining('door'),
        confidence: expect.any(Number)
      }
    },
    {
      message: "Need custom kitchen cabinets made",
      expected: {
        serviceType: 'carpentry',
        urgency: 'low',
        description: expect.stringContaining('cabinet'),
        confidence: expect.any(Number)
      }
    }
  ],

  cleaning: [
    {
      message: "House is very dirty, need deep cleaning service",
      expected: {
        serviceType: 'cleaning',
        urgency: 'medium',
        description: expect.stringContaining('cleaning'),
        confidence: expect.any(Number)
      }
    },
    {
      message: "Weekly house cleaning needed",
      expected: {
        serviceType: 'cleaning',
        urgency: 'low',
        description: expect.stringContaining('cleaning'),
        confidence: expect.any(Number)
      }
    }
  ],

  painting: [
    {
      message: "Want to paint my bedroom walls blue",
      expected: {
        serviceType: 'painting',
        urgency: 'low',
        description: expect.stringContaining('paint'),
        confidence: expect.any(Number)
      }
    },
    {
      message: "Exterior house painting needed before rainy season",
      expected: {
        serviceType: 'painting',
        urgency: 'medium',
        description: expect.stringContaining('paint'),
        confidence: expect.any(Number)
      }
    }
  ],

  ambiguous: [
    {
      message: "Something is broken in my house",
      expected: {
        serviceType: 'other',
        urgency: 'medium',
        confidence: expect.any(Number)
      }
    },
    {
      message: "Help me fix this thing",
      expected: {
        serviceType: 'other',
        urgency: 'medium',
        confidence: expect.any(Number)
      }
    }
  ],

  intents: [
    {
      message: "Hello, I'm new here",
      expected: {
        intent: 'greeting',
        confidence: expect.any(Number)
      }
    },
    {
      message: "I want to see my previous bookings",
      expected: {
        intent: 'view_bookings',
        confidence: expect.any(Number)
      }
    },
    {
      message: "How do I cancel my booking?",
      expected: {
        intent: 'cancel_booking',
        confidence: expect.any(Number)
      }
    },
    {
      message: "I want to rate the plumber who came yesterday",
      expected: {
        intent: 'rate_service',
        confidence: expect.any(Number)
      }
    },
    {
      message: "What services do you offer?",
      expected: {
        intent: 'help',
        confidence: expect.any(Number)
      }
    }
  ]
};

/**
 * Nigerian-specific examples with local context
 */
const nigerianContextExamples = [
  {
    message: "My NEPA light socket is sparking, abeg help me",
    expected: {
      serviceType: 'electrical',
      urgency: 'high',
      description: expect.stringContaining('socket'),
      confidence: expect.any(Number)
    }
  },
  {
    message: "Water no dey flow for my pipe, wetin I go do?",
    expected: {
      serviceType: 'plumbing',
      urgency: 'medium',
      description: expect.stringContaining('water'),
      confidence: expect.any(Number)
    }
  },
  {
    message: "I wan paint my house before Christmas",
    expected: {
      serviceType: 'painting',
      urgency: 'medium',
      description: expect.stringContaining('paint'),
      confidence: expect.any(Number)
    }
  },
  {
    message: "My toilet don block, e dey smell well well",
    expected: {
      serviceType: 'plumbing',
      urgency: 'high',
      description: expect.stringContaining('toilet'),
      confidence: expect.any(Number)
    }
  }
];

/**
 * Location-specific examples
 */
const locationExamples = [
  {
    message: "Need plumber in Victoria Island Lagos",
    context: { userLocation: "Lagos, Nigeria" },
    expected: {
      serviceType: 'plumbing',
      location: expect.stringContaining('Victoria Island'),
      confidence: expect.any(Number)
    }
  },
  {
    message: "Electrician needed in Abuja FCT",
    context: { userLocation: "Abuja, Nigeria" },
    expected: {
      serviceType: 'electrical',
      location: expect.stringContaining('Abuja'),
      confidence: expect.any(Number)
    }
  }
];

/**
 * Budget and time preference examples
 */
const detailedExamples = [
  {
    message: "Need plumber tomorrow morning, budget is 20k naira",
    expected: {
      serviceType: 'plumbing',
      timePreference: expect.stringContaining('morning'),
      budget: expect.stringContaining('20'),
      confidence: expect.any(Number)
    }
  },
  {
    message: "Electrical work needed this weekend, can pay up to 50,000 naira",
    expected: {
      serviceType: 'electrical',
      timePreference: expect.stringContaining('weekend'),
      budget: expect.stringContaining('50'),
      confidence: expect.any(Number)
    }
  }
];

module.exports = {
  nlpTestExamples,
  nigerianContextExamples,
  locationExamples,
  detailedExamples
};