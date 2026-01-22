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

      // Service type selections
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
    if (session.flow === 'service_request' && session.step === 'description') {
      await handleServiceDescription(chatId, msg.from, msg.text, session);
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
  session.step = 'location';

  const message = `Great! I understand you need help with: "${description}"

Now I need to know your location to find nearby artisans. 

Please share your location using one of these methods:

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
 * Placeholder functions for artisan features (to be implemented in later tasks)
 */
const startArtisanRegistration = async (chatId, user) => {
  await bot.sendMessage(chatId, '🚧 Artisan registration will be implemented in the next phase. Stay tuned!');
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

const handleArtisanRegistrationInput = async (chatId, user, text, session) => {
  await bot.sendMessage(chatId, '🚧 Registration flow will be implemented in the next phase!');
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

module.exports = { initializeBot, getBot, stopBot };