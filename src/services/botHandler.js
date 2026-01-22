const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const UserService = require('./UserService');
const ArtisanService = require('./ArtisanService');

let bot;
let userService;
let artisanService;

// User session storage (in production, use Redis or database)
const userSessions = new Map();

const initializeBot = async () => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
    }

    // Stop existing bot instance if it exists
    if (bot) {
      try {
        await bot.stopPolling();
        logger.info('Stopped existing bot instance');
      } catch (error) {
        logger.warn('Error stopping existing bot:', error.message);
      }
    }

    // Create new bot instance with polling options
    bot = new TelegramBot(token, { 
      polling: {
        interval: 1000,
        autoStart: false,
        params: {
          timeout: 10
        }
      }
    });

    userService = new UserService();
    artisanService = new ArtisanService();

    // Command handlers
    bot.onText(/\/start/, handleStart);
    bot.onText(/\/help/, handleHelp);
    bot.onText(/\/menu/, handleMainMenu);

    // Callback query handler for inline keyboards
    bot.on('callback_query', handleCallbackQuery);

    // Message handler for text inputs
    bot.on('message', handleMessage);

    // Enhanced error handling
    bot.on('polling_error', (error) => {
      if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
        logger.warn('Bot polling conflict detected - another instance may be running');
        // Try to restart polling after a delay
        setTimeout(async () => {
          try {
            await bot.stopPolling();
            await new Promise(resolve => setTimeout(resolve, 2000));
            await bot.startPolling();
            logger.info('Bot polling restarted successfully');
          } catch (restartError) {
            logger.error('Failed to restart bot polling:', restartError);
          }
        }, 5000);
      } else {
        logger.error('Telegram bot polling error:', error);
      }
    });

    // Start polling manually
    await bot.startPolling();

    logger.info('Telegram bot initialized and polling started successfully');
    return bot;

  } catch (error) {
    logger.error('Failed to initialize Telegram bot:', error);
    throw error;
  }
};

/**
 * Handle /start command - main entry point
 */
const handleStart = async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;

  try {
    // Create or update user in database
    await userService.createUser(user);
    
    // Check if user is already an artisan
    const artisan = await artisanService.getArtisanProfile(user.id);
    
    if (artisan) {
      // User is an existing artisan
      await showArtisanDashboard(chatId, artisan);
    } else {
      // New user - show role selection
      await showRoleSelection(chatId, user.first_name);
    }

  } catch (error) {
    logger.error('Error in handleStart:', error);
    await bot.sendMessage(chatId, '❌ Sorry, something went wrong. Please try again later.');
  }
};

/**
 * Show role selection for new users
 */
const showRoleSelection = async (chatId, firstName) => {
  const welcomeMessage = `Welcome to the Artisan Marketplace, ${firstName}! 🔧

I'm here to help you connect with skilled artisans or help you grow your artisan business.

What brings you here today?`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔍 Find Artisans', callback_data: 'role_customer' },
        { text: '🛠️ I\'m an Artisan', callback_data: 'role_artisan' }
      ],
      [
        { text: '❓ Learn More', callback_data: 'learn_more' }
      ]
    ]
  };

  await bot.sendMessage(chatId, welcomeMessage, { reply_markup: keyboard });
};

/**
 * Show artisan dashboard for existing artisans
 */
const showArtisanDashboard = async (chatId, artisan) => {
  const dashboardMessage = `Welcome back, ${artisan.fullName}! 👋

**Your Artisan Profile:**
🏆 Tier: ${artisan.tier.current}
⭐ Rating: ${artisan.metrics.averageRating.toFixed(1)}/5.0
📊 Total Jobs: ${artisan.metrics.totalJobs}
💰 Total Earnings: ₦${artisan.metrics.totalEarnings.toLocaleString()}

What would you like to do?`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 View Available Jobs', callback_data: 'artisan_jobs' },
        { text: '📊 My Statistics', callback_data: 'artisan_stats' }
      ],
      [
        { text: '👤 Edit Profile', callback_data: 'artisan_profile' },
        { text: '📷 Manage Portfolio', callback_data: 'artisan_portfolio' }
      ],
      [
        { text: '⚙️ Availability Settings', callback_data: 'artisan_availability' }
      ],
      [
        { text: '🔍 Switch to Customer Mode', callback_data: 'role_customer' }
      ]
    ]
  };

  await bot.sendMessage(chatId, dashboardMessage, { 
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
};

/**
 * Show customer service categories
 */
const showServiceCategories = async (chatId) => {
  const message = `Great! Let's find the perfect artisan for your needs. 🎯

What type of service do you need?`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔧 Plumbing', callback_data: 'service_plumbing' },
        { text: '⚡ Electrical', callback_data: 'service_electrical' }
      ],
      [
        { text: '🪚 Carpentry', callback_data: 'service_carpentry' },
        { text: '🧹 Cleaning', callback_data: 'service_cleaning' }
      ],
      [
        { text: '🎨 Painting', callback_data: 'service_painting' },
        { text: '❄️ HVAC', callback_data: 'service_hvac' }
      ],
      [
        { text: '🌿 Landscaping', callback_data: 'service_landscaping' },
        { text: '🔨 Other Services', callback_data: 'service_other' }
      ],
      [
        { text: '🔙 Back to Menu', callback_data: 'main_menu' }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, { reply_markup: keyboard });
};

/**
 * Show artisan onboarding flow
 */
const showArtisanOnboarding = async (chatId) => {
  const message = `Excellent! Let's get you set up as an artisan. 🛠️

To join our marketplace, you'll need to provide:

✅ Personal Information
✅ Business Details & Services
✅ Location & Service Area
✅ Bank Account Details
✅ Portfolio Samples (optional but recommended)

This helps us verify your credentials and connect you with the right customers.

Ready to get started?`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🚀 Start Registration', callback_data: 'artisan_register_start' }
      ],
      [
        { text: '📋 View Requirements', callback_data: 'artisan_requirements' },
        { text: '🔙 Back', callback_data: 'main_menu' }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, { reply_markup: keyboard });
};

/**
 * Handle callback queries from inline keyboards
 */
const handleCallbackQuery = async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const user = callbackQuery.from;

  try {
    // Answer the callback query to remove loading state
    await bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
      case 'role_customer':
        await showServiceCategories(chatId);
        break;

      case 'role_artisan':
        await showArtisanOnboarding(chatId);
        break;

      case 'learn_more':
        await showLearnMore(chatId);
        break;

      case 'main_menu':
        await handleStart({ chat: { id: chatId }, from: user });
        break;

      case 'artisan_register_start':
        await startArtisanRegistration(chatId, user);
        break;

      case 'artisan_requirements':
        await showArtisanRequirements(chatId);
        break;

      case 'artisan_jobs':
        await showAvailableJobs(chatId, user);
        break;

      case 'artisan_stats':
        await showArtisanStats(chatId, user);
        break;

      case 'artisan_profile':
        await showArtisanProfile(chatId, user);
        break;

      case 'artisan_portfolio':
        await showArtisanPortfolio(chatId, user);
        break;

      case 'artisan_availability':
        await showArtisanAvailability(chatId, user);
        break;

      // Service type selections for customers
      case 'service_plumbing':
      case 'service_electrical':
      case 'service_carpentry':
      case 'service_cleaning':
      case 'service_painting':
      case 'service_hvac':
      case 'service_landscaping':
      case 'service_other':
        const serviceType = data.replace('service_', '');
        await handleServiceSelection(chatId, user, serviceType);
        break;

      // Artisan registration service selections
      case 'reg_service_plumbing':
      case 'reg_service_electrical':
      case 'reg_service_carpentry':
      case 'reg_service_cleaning':
      case 'reg_service_painting':
      case 'reg_service_hvac':
      case 'reg_service_landscaping':
      case 'reg_service_other':
        const regServiceType = data.replace('reg_service_', '');
        await handleRegistrationServiceType(chatId, user, regServiceType);
        break;

      // Urgency level selections
      case 'urgency_emergency':
      case 'urgency_high':
      case 'urgency_medium':
      case 'urgency_low':
        const urgencyLevel = data.replace('urgency_', '');
        await handleUrgencySelection(chatId, user, urgencyLevel);
        break;

      default:
        await bot.sendMessage(chatId, '❓ Unknown option. Please try again.');
    }

  } catch (error) {
    logger.error('Error in handleCallbackQuery:', error);
    await bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
  }
};

/**
 * Handle service selection and prompt for description
 */
const handleServiceSelection = async (chatId, user, serviceType) => {
  // Store user's service selection in session
  userSessions.set(chatId, {
    userId: user.id,
    flow: 'service_request',
    serviceType: serviceType,
    step: 'description'
  });

  const serviceNames = {
    plumbing: 'Plumbing',
    electrical: 'Electrical',
    carpentry: 'Carpentry',
    cleaning: 'Cleaning',
    painting: 'Painting',
    hvac: 'HVAC',
    landscaping: 'Landscaping',
    other: 'Other Services'
  };

  const message = `Perfect! You've selected **${serviceNames[serviceType]}** services. 🎯

Now, please describe what you need help with. Be as specific as possible:

Examples:
• "Fix leaking kitchen sink pipe"
• "Install ceiling fan in bedroom"
• "Paint 3-bedroom apartment walls"

Just type your description below:`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};

/**
 * Show learn more information
 */
const showLearnMore = async (chatId) => {
  const message = `**About Artisan Marketplace** 🏪

**For Customers:**
🔍 Find verified, skilled artisans
⭐ View ratings and portfolios
📱 Book services through chat
💳 Secure payment options
📞 Direct communication with artisans

**For Artisans:**
🏆 Build your professional profile
📈 Grow your customer base
💰 Earn more with our tier system
📊 Track your performance
🎯 Get matched with nearby customers

**Our Tier System:**
🥉 **Foundation** - New artisans starting out
🥈 **Professional** - Experienced with proven track record
🥇 **Elite** - Top-tier artisans with premium projects

Ready to get started?`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔍 Find Artisans', callback_data: 'role_customer' },
        { text: '🛠️ Become an Artisan', callback_data: 'role_artisan' }
      ],
      [
        { text: '🔙 Back to Start', callback_data: 'main_menu' }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, { 
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
};

/**
 * Handle text messages based on user session
 */
const handleMessage = async (msg) => {
  // Skip if it's a command
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }

  const chatId = msg.chat.id;
  const session = userSessions.get(chatId);

  if (!session) {
    // No active session, show main menu
    await bot.sendMessage(chatId, 'Please use /start to begin or /menu to see options.');
    return;
  }

  try {
    if (session.flow === 'service_request') {
      switch (session.step) {
        case 'description':
          await handleServiceDescription(chatId, msg.from, msg.text, session);
          break;
        case 'problem_details':
          await handleProblemDetails(chatId, msg.from, msg.text, session);
          break;
        case 'location':
          await handleCustomerLocationInput(chatId, msg.from, msg.text, session);
          break;
      }
    } else if (session.flow === 'artisan_registration') {
      await handleArtisanRegistrationInput(chatId, msg.from, msg.text, session);
    }
  } catch (error) {
    logger.error('Error in handleMessage:', error);
    await bot.sendMessage(chatId, '❌ Something went wrong. Please try again or use /start to restart.');
  }
};

/**
 * Handle service description input
 */
const handleServiceDescription = async (chatId, user, description, session) => {
  // Store description in session
  session.description = description;
  session.step = 'problem_details';

  const message = `Got it! You need help with: "${description}"

**Let's get more details to find the perfect artisan:**

Please tell me more about the specific problem or what might be wrong:

**Examples:**
• "The pipe is leaking under the sink and water is pooling on the floor"
• "The electrical outlet in the bedroom stopped working after a power surge"
• "The wooden floor is creaking and some boards are loose"

**The more details you provide, the better we can match you with the right specialist!**

Please describe the problem in detail:`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};

/**
 * Handle problem details input from customer
 */
const handleProblemDetails = async (chatId, user, problemDetails, session) => {
  session.problemDetails = problemDetails;
  session.step = 'urgency';

  const message = `Perfect! Now I understand the situation better. 👍

**Problem Summary:**
${session.description}

**Details:** ${problemDetails}

**How urgent is this issue?**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🚨 Emergency (ASAP)', callback_data: 'urgency_emergency' },
        { text: '🔴 High (Today)', callback_data: 'urgency_high' }
      ],
      [
        { text: '🟡 Medium (This week)', callback_data: 'urgency_medium' },
        { text: '🟢 Low (Flexible)', callback_data: 'urgency_low' }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, { 
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
};

/**
 * Start artisan registration process
 */
const startArtisanRegistration = async (chatId, user) => {
  // Initialize registration session
  userSessions.set(chatId, {
    userId: user.id,
    flow: 'artisan_registration',
    step: 'service_type',
    data: {
      telegramId: user.id,
      personalInfo: {
        firstName: user.first_name,
        lastName: user.last_name || '',
        phone: '',
        email: ''
      },
      businessInfo: {
        serviceTypes: [],
        yearsExperience: 0,
        specialties: [],
        challengingJobs: [],
        topWorkplaces: []
      },
      location: {
        latitude: null,
        longitude: null,
        address: '',
        serviceRadius: 15
      },
      bankDetails: {
        accountName: '',
        accountNumber: '',
        bankName: '',
        routingCode: ''
      }
    }
  });

  const message = `Great! Let's get you registered as an artisan. 🛠️

**Step 1 of 8: Your Main Service**

What type of service do you primarily provide? Choose your main expertise:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔧 Plumbing', callback_data: 'reg_service_plumbing' },
        { text: '⚡ Electrical', callback_data: 'reg_service_electrical' }
      ],
      [
        { text: '🪚 Carpentry', callback_data: 'reg_service_carpentry' },
        { text: '🧹 Cleaning', callback_data: 'reg_service_cleaning' }
      ],
      [
        { text: '🎨 Painting', callback_data: 'reg_service_painting' },
        { text: '❄️ HVAC', callback_data: 'reg_service_hvac' }
      ],
      [
        { text: '🌿 Landscaping', callback_data: 'reg_service_landscaping' },
        { text: '🔨 Other', callback_data: 'reg_service_other' }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, { reply_markup: keyboard });
};

const showArtisanRequirements = async (chatId) => {
  const message = `**Artisan Registration Requirements** 📋

**Personal Information:**
• Full name and phone number
• Valid email address
• Government-issued ID

**Business Details:**
• Services you provide
• Years of experience
• Professional certifications (if any)

**Location & Service Area:**
• Your business location
• Areas you serve
• Maximum travel distance

**Financial Information:**
• Bank account details for payments
• Tax information (if applicable)

**Portfolio (Recommended):**
• Photos of completed work
• Project descriptions
• Client testimonials

All information is verified to ensure quality and trust in our marketplace.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🚀 Start Registration', callback_data: 'artisan_register_start' }
      ],
      [
        { text: '🔙 Back', callback_data: 'role_artisan' }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, { 
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
};

const showAvailableJobs = async (chatId, user) => {
  await bot.sendMessage(chatId, '🚧 Job listings will be available once booking system is implemented!');
};

const showArtisanStats = async (chatId, user) => {
  await bot.sendMessage(chatId, '🚧 Statistics dashboard coming soon!');
};

const showArtisanProfile = async (chatId, user) => {
  await bot.sendMessage(chatId, '🚧 Profile management will be available soon!');
};

const showArtisanPortfolio = async (chatId, user) => {
  await bot.sendMessage(chatId, '🚧 Portfolio management coming in the next update!');
};

const showArtisanAvailability = async (chatId, user) => {
  await bot.sendMessage(chatId, '🚧 Availability settings will be implemented soon!');
};

/**
 * Handle registration service type selection
 */
const handleRegistrationServiceType = async (chatId, user, serviceType) => {
  try {
    const session = userSessions.get(chatId);
    if (!session || session.flow !== 'artisan_registration') {
      await bot.sendMessage(chatId, 'Registration session expired. Please start again with /start');
      return;
    }

    // Store service type
    session.data.businessInfo.serviceTypes = [serviceType];
    session.step = 'years_experience';

    const serviceNames = {
      plumbing: 'Plumbing',
      electrical: 'Electrical',
      carpentry: 'Carpentry',
      cleaning: 'Cleaning',
      painting: 'Painting',
      hvac: 'HVAC',
      landscaping: 'Landscaping',
      other: 'Other Services'
    };

    const message = `Great! You selected **${serviceNames[serviceType]}**. ✅

**Step 2 of 8: Experience Level**

How many years of professional experience do you have in ${serviceNames[serviceType].toLowerCase()}?

Please type a number (e.g., 5 for 5 years):`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    logger.error('Error in handleRegistrationServiceType:', error);
    await bot.sendMessage(chatId, `❌ Error: ${error.message}. Please try again or use /start to restart.`);
  }
};

/**
 * Handle artisan registration input based on current step
 */
const handleArtisanRegistrationInput = async (chatId, user, text, session) => {
  try {
    switch (session.step) {
      case 'years_experience':
        await handleExperienceInput(chatId, user, text, session);
        break;
      
      case 'specialties':
        await handleSpecialtiesInput(chatId, user, text, session);
        break;
      
      case 'top_workplaces':
        await handleWorkplacesInput(chatId, user, text, session);
        break;
      
      case 'challenging_job_1':
        await handleChallengingJob1Input(chatId, user, text, session);
        break;
      
      case 'challenging_job_2':
        await handleChallengingJob2Input(chatId, user, text, session);
        break;
      
      case 'phone':
        await handlePhoneInput(chatId, user, text, session);
        break;
      
      case 'location_address':
        await handleLocationInput(chatId, user, text, session);
        break;
      
      case 'bank_details':
        await handleBankDetailsInput(chatId, user, text, session);
        break;
      
      default:
        await bot.sendMessage(chatId, 'Something went wrong. Please use /start to restart registration.');
    }
  } catch (error) {
    logger.error('Error in handleArtisanRegistrationInput:', error);
    await bot.sendMessage(chatId, '❌ Something went wrong. Please try again or use /start to restart.');
  }
};

/**
 * Handle years of experience input
 */
const handleExperienceInput = async (chatId, user, text, session) => {
  const years = parseInt(text.trim());
  
  if (isNaN(years) || years < 0 || years > 50) {
    await bot.sendMessage(chatId, '❌ Please enter a valid number of years (0-50). For example: 5');
    return;
  }

  session.data.businessInfo.yearsExperience = years;
  session.step = 'specialties';

  const serviceType = session.data.businessInfo.serviceTypes[0];
  const message = `Perfect! ${years} years of experience. 👍

**Step 3 of 8: Specialties**

Do you have any specific specialties within ${serviceType}? This helps us match you with the right jobs.

Examples for ${serviceType}:
${getSpecialtyExamples(serviceType)}

Please list your specialties separated by commas, or type "none" if you don't have specific specialties:`;

  await bot.sendMessage(chatId, message);
};

/**
 * Get specialty examples based on service type
 */
const getSpecialtyExamples = (serviceType) => {
  const examples = {
    plumbing: '• Pipe installation, Drain cleaning, Water heater repair, Bathroom renovation',
    electrical: '• Wiring installation, Solar panels, Smart home systems, Industrial electrical',
    carpentry: '• Custom furniture, Kitchen cabinets, Flooring, Roofing',
    cleaning: '• Deep cleaning, Office cleaning, Post-construction cleanup, Carpet cleaning',
    painting: '• Interior painting, Exterior painting, Decorative finishes, Commercial painting',
    hvac: '• AC installation, Heating repair, Ventilation systems, Refrigeration',
    landscaping: '• Garden design, Tree trimming, Irrigation systems, Lawn maintenance',
    other: '• List your specific areas of expertise'
  };
  
  return examples[serviceType] || '• List your specific areas of expertise';
};

/**
 * Handle specialties input
 */
const handleSpecialtiesInput = async (chatId, user, text, session) => {
  const specialtiesText = text.trim().toLowerCase();
  
  if (specialtiesText === 'none') {
    session.data.businessInfo.specialties = [];
  } else {
    const specialties = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
    session.data.businessInfo.specialties = specialties;
  }

  session.step = 'top_workplaces';

  const message = `Great! ${session.data.businessInfo.specialties.length > 0 ? 'Specialties noted' : 'No specific specialties'} ✅

**Step 4 of 8: Work History**

Please tell me about the top 3 places or types of projects you've worked on. This builds credibility with customers.

Examples:
• "Marriott Hotel Lagos - plumbing renovation"
• "Residential homes in Lekki"
• "Shopping malls and commercial buildings"

Please list them, one per line:`;

  await bot.sendMessage(chatId, message);
};

/**
 * Handle top workplaces input
 */
const handleWorkplacesInput = async (chatId, user, text, session) => {
  const workplaces = text.split('\n').map(w => w.trim()).filter(w => w.length > 0);
  session.data.businessInfo.topWorkplaces = workplaces;
  session.step = 'challenging_job_1';

  const message = `Excellent work history! 🏆

**Step 5 of 8: Challenging Job Stories (1/2)**

Tell me about your most challenging job. This helps us understand your problem-solving skills and match you with complex projects.

Please describe:
• What was the problem?
• How did you solve it?
• What was the outcome?

Example: "Customer had a burst pipe in a tight space behind the kitchen wall. I had to carefully cut access holes, replace the damaged section, and restore the wall without damaging the kitchen cabinets. Customer was very satisfied and referred 3 neighbors."`;

  await bot.sendMessage(chatId, message);
};

/**
 * Handle first challenging job input
 */
const handleChallengingJob1Input = async (chatId, user, text, session) => {
  session.data.businessInfo.challengingJobs.push({
    story: text.trim(),
    order: 1
  });
  session.step = 'challenging_job_2';

  const message = `Great story! That shows real problem-solving skills. 💪

**Step 6 of 8: Challenging Job Stories (2/2)**

Tell me about another challenging job or project. This gives customers more confidence in your abilities.

Please describe another situation where you overcame difficulties:`;

  await bot.sendMessage(chatId, message);
};

/**
 * Handle second challenging job input
 */
const handleChallengingJob2Input = async (chatId, user, text, session) => {
  session.data.businessInfo.challengingJobs.push({
    story: text.trim(),
    order: 2
  });
  session.step = 'phone';

  const message = `Excellent! Your experience stories are impressive. 🌟

**Step 7 of 8: Contact Information**

I need your phone number so customers can reach you directly for urgent jobs.

Please enter your phone number (e.g., +2348012345678):`;

  await bot.sendMessage(chatId, message);
};

/**
 * Handle phone input
 */
const handlePhoneInput = async (chatId, user, text, session) => {
  const phone = text.trim();
  
  // Basic phone validation
  if (phone.length < 10 || !phone.match(/[\d\+\-\s\(\)]/)) {
    await bot.sendMessage(chatId, '❌ Please enter a valid phone number. Example: +2348012345678');
    return;
  }

  session.data.personalInfo.phone = phone;
  session.step = 'location_address';

  const message = `Phone number saved! 📞

**Step 8 of 8: Location**

Finally, I need to know your location to match you with nearby customers.

Please share your location using one of these methods:

📍 **Option 1:** Use the location button below
📝 **Option 2:** Type your address (e.g., "Ikeja, Lagos State")`;

  const keyboard = {
    keyboard: [
      [{ text: '📍 Share My Location', request_location: true }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };

  await bot.sendMessage(chatId, message, { reply_markup: keyboard });
};

/**
 * Handle location input (text address)
 */
const handleLocationInput = async (chatId, user, text, session) => {
  session.data.location.address = text.trim();
  // For now, we'll use default coordinates for Lagos
  session.data.location.latitude = 6.5244;
  session.data.location.longitude = 3.3792;

  await completeArtisanRegistration(chatId, user, session);
};

/**
 * Complete artisan registration
 */
const completeArtisanRegistration = async (chatId, user, session) => {
  try {
    // Ensure all required fields are set
    if (!session.data.personalInfo.lastName) {
      session.data.personalInfo.lastName = session.data.personalInfo.firstName; // Use first name as fallback
    }
    
    if (!session.data.personalInfo.phone) {
      await bot.sendMessage(chatId, '❌ Phone number is required. Please restart registration.');
      return;
    }

    // Add bank details placeholder (will be collected later)
    session.data.bankDetails = {
      accountName: `${session.data.personalInfo.firstName} ${session.data.personalInfo.lastName}`,
      accountNumber: 'PENDING',
      bankName: 'PENDING',
      routingCode: ''
    };

    // Ensure location has required fields
    if (!session.data.location.latitude || !session.data.location.longitude) {
      session.data.location.latitude = 6.5244; // Default Lagos coordinates
      session.data.location.longitude = 3.3792;
    }

    logger.info('Attempting to register artisan:', {
      telegramId: session.data.telegramId,
      firstName: session.data.personalInfo.firstName,
      lastName: session.data.personalInfo.lastName,
      phone: session.data.personalInfo.phone,
      serviceTypes: session.data.businessInfo.serviceTypes,
      yearsExperience: session.data.businessInfo.yearsExperience
    });

    // Register the artisan
    const artisan = await artisanService.registerArtisan(session.data);

    // Clear session
    userSessions.delete(chatId);

    const message = `🎉 **Congratulations! Registration Complete!** 🎉

Welcome to the Artisan Marketplace, ${artisan.fullName}!

**Your Profile Summary:**
🛠️ **Service:** ${session.data.businessInfo.serviceTypes[0]}
📅 **Experience:** ${session.data.businessInfo.yearsExperience} years
🏆 **Tier:** ${artisan.tier.current}
📍 **Location:** ${session.data.location.address}

**Next Steps:**
1. Complete your bank details for payments
2. Add portfolio photos (optional but recommended)
3. Set your availability schedule
4. Start receiving job requests!

**Important:** You'll need to provide bank account details before you can receive payments. We'll guide you through this when you get your first job.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📊 View My Dashboard', callback_data: 'artisan_stats' },
          { text: '📋 Available Jobs', callback_data: 'artisan_jobs' }
        ],
        [
          { text: '⚙️ Complete Bank Details', callback_data: 'artisan_bank_setup' }
        ]
      ]
    };

    await bot.sendMessage(chatId, message, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    logger.error('Error completing artisan registration:', error);
    
    if (error.message.includes('already registered')) {
      await bot.sendMessage(chatId, '❌ You are already registered as an artisan. Use /start to access your dashboard.');
    } else if (error.message.includes('validation')) {
      await bot.sendMessage(chatId, `❌ Registration validation error: ${error.message}. Please contact support.`);
    } else {
      await bot.sendMessage(chatId, `❌ Registration failed: ${error.message}. Please try again later or contact support.`);
    }
    
    userSessions.delete(chatId);
  }
};

/**
 * Handle /help command
 */
const handleHelp = async (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `**Artisan Marketplace Help** 📚

**Available Commands:**
/start - Start or restart the bot
/menu - Show main menu
/help - Show this help message

**How it works:**

**For Customers:**
1. Select "Find Artisans"
2. Choose your service type
3. Describe what you need
4. Share your location
5. Browse and select artisans
6. Book and pay for services

**For Artisans:**
1. Select "I'm an Artisan"
2. Complete registration
3. Build your profile and portfolio
4. Set your availability
5. Receive and accept job requests
6. Get paid for completed work

Need more help? Contact our support team!`;

  await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
};

/**
 * Handle /menu command
 */
const handleMainMenu = async (msg) => {
  await handleStart(msg);
};

const getBot = () => {
  if (!bot) {
    throw new Error('Bot not initialized. Call initializeBot() first.');
  }
  return bot;
};

/**
 * Cleanup function to properly stop the bot
 */
const stopBot = async () => {
  if (bot) {
    try {
      await bot.stopPolling();
      logger.info('Bot polling stopped successfully');
    } catch (error) {
      logger.error('Error stopping bot:', error);
    }
    bot = null;
  }
};

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down bot gracefully...');
  await stopBot();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down bot gracefully...');
  await stopBot();
  process.exit(0);
});

/**
 * Handle urgency selection from customer
 */
const handleUrgencySelection = async (chatId, user, urgencyLevel) => {
  const session = userSessions.get(chatId);
  if (!session || session.flow !== 'service_request') {
    await bot.sendMessage(chatId, 'Session expired. Please start again with /start');
    return;
  }

  session.urgency = urgencyLevel;
  session.step = 'location';

  const urgencyLabels = {
    emergency: '🚨 Emergency (ASAP)',
    high: '🔴 High Priority (Today)',
    medium: '🟡 Medium Priority (This week)',
    low: '🟢 Low Priority (Flexible)'
  };

  const message = `Got it! Priority level: ${urgencyLabels[urgencyLevel]}

**Final step - I need your location to find nearby artisans:**

Please share your location so I can find the best artisans in your area:

📍 **Option 1:** Use the location button below
📝 **Option 2:** Type your address (e.g., "Victoria Island, Lagos")`;

  const keyboard = {
    keyboard: [
      [{ text: '📍 Share My Location', request_location: true }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };

  await bot.sendMessage(chatId, message, { 
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
};

/**
 * Handle customer location input (text address)
 */
const handleCustomerLocationInput = async (chatId, user, address, session) => {
  session.location = {
    address: address.trim(),
    latitude: 6.5244, // Default Lagos coordinates
    longitude: 3.3792
  };

  await findAndShowArtisans(chatId, user, session);
};

/**
 * Find and show matching artisans to customer
 */
const findAndShowArtisans = async (chatId, user, session) => {
  try {
    // Create user if not exists
    await userService.createUser(user);

    // Find nearby artisans based on specialties and service type
    let artisans = await artisanService.findNearbyArtisans(
      session.location.latitude,
      session.location.longitude,
      session.serviceType,
      15, // 15km radius
      10  // Get more to filter by specialties
    );

    // Filter artisans by specialties that match the problem description
    if (session.problemDetails && artisans.length > 0) {
      const problemKeywords = session.problemDetails.toLowerCase();
      
      // Score artisans based on specialty match
      artisans = artisans.map(artisan => {
        let specialtyScore = 0;
        
        if (artisan.businessInfo.specialties && artisan.businessInfo.specialties.length > 0) {
          artisan.businessInfo.specialties.forEach(specialty => {
            if (problemKeywords.includes(specialty.toLowerCase())) {
              specialtyScore += 2; // High match for exact specialty
            }
          });
        }
        
        // Check challenging jobs for relevant experience
        if (artisan.businessInfo.challengingJobs && artisan.businessInfo.challengingJobs.length > 0) {
          artisan.businessInfo.challengingJobs.forEach(job => {
            if (job.story && job.story.toLowerCase().includes(problemKeywords.split(' ')[0])) {
              specialtyScore += 1; // Medium match for similar experience
            }
          });
        }
        
        return { ...artisan.toObject(), specialtyScore };
      });

      // Sort by specialty score first, then by rating and tier
      artisans.sort((a, b) => {
        if (a.specialtyScore !== b.specialtyScore) {
          return b.specialtyScore - a.specialtyScore;
        }
        return b.metrics.averageRating - a.metrics.averageRating;
      });
    }

    // Take top 5
    artisans = artisans.slice(0, 5);

    if (artisans.length === 0) {
      const message = `😔 **No artisans found nearby**

Unfortunately, we don't have any ${session.serviceType} specialists available in your area right now.

**What you can do:**
• Try expanding your search area
• Check back later as new artisans join daily
• Contact our support for assistance

Would you like to try a different service type or location?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Try Different Service', callback_data: 'role_customer' },
            { text: '📞 Contact Support', callback_data: 'contact_support' }
          ],
          [
            { text: '🏠 Back to Menu', callback_data: 'main_menu' }
          ]
        ]
      };

      await bot.sendMessage(chatId, message, { 
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
      return;
    }

    // Show artisan results
    const serviceNames = {
      plumbing: 'Plumbing',
      electrical: 'Electrical',
      carpentry: 'Carpentry',
      cleaning: 'Cleaning',
      painting: 'Painting',
      hvac: 'HVAC',
      landscaping: 'Landscaping',
      other: 'Other Services'
    };

    let message = `🎯 **Found ${artisans.length} ${serviceNames[session.serviceType]} Specialists Near You!**

**Your Request:**
📋 ${session.description}
📝 ${session.problemDetails}
⚡ Priority: ${session.urgency}
📍 Location: ${session.location.address}

**Recommended Artisans:**\n\n`;

    const keyboard = { inline_keyboard: [] };

    artisans.forEach((artisan, index) => {
      const tierEmoji = {
        'Foundation': '🥉',
        'Professional': '🥈', 
        'Elite': '🥇'
      };

      const specialtyMatch = artisan.specialtyScore > 0 ? '🎯 ' : '';
      const specialtiesText = artisan.businessInfo.specialties && artisan.businessInfo.specialties.length > 0 
        ? `\n🔧 Specialties: ${artisan.businessInfo.specialties.slice(0, 2).join(', ')}`
        : '';

      message += `**${index + 1}. ${specialtyMatch}${artisan.fullName || artisan.personalInfo.firstName + ' ' + artisan.personalInfo.lastName}** ${tierEmoji[artisan.tier.current] || '🥉'}
⭐ ${artisan.metrics.averageRating.toFixed(1)}/5.0 (${artisan.metrics.totalJobs} jobs)
📅 ${artisan.businessInfo.yearsExperience} years experience${specialtiesText}
📍 ${artisan.location.address}

`;

      // Add buttons for each artisan
      keyboard.inline_keyboard.push([
        { text: `👤 View ${artisan.personalInfo.firstName}'s Profile`, callback_data: `view_artisan_${artisan._id}` },
        { text: `📞 Book ${artisan.personalInfo.firstName}`, callback_data: `book_artisan_${artisan._id}` }
      ]);
    });

    // Add navigation buttons
    keyboard.inline_keyboard.push([
      { text: '🔄 New Search', callback_data: 'role_customer' },
      { text: '🏠 Main Menu', callback_data: 'main_menu' }
    ]);

    await bot.sendMessage(chatId, message, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });

    // Clear the session
    userSessions.delete(chatId);

  } catch (error) {
    logger.error('Error finding artisans:', error);
    await bot.sendMessage(chatId, '❌ Something went wrong while searching for artisans. Please try again.');
  }
};

module.exports = { initializeBot, getBot, stopBot };