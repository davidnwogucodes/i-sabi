const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

let bot;

const initializeBot = async () => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
    }

    bot = new TelegramBot(token, { polling: true });

    // Basic command handlers (will be expanded in later tasks)
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, 'Welcome to the Artisan Marketplace! 🔧\n\nI\'ll help you find verified artisans for your needs.');
    });

    bot.on('polling_error', (error) => {
      logger.error('Telegram bot polling error:', error);
    });

    logger.info('Telegram bot initialized successfully');
    return bot;

  } catch (error) {
    logger.error('Failed to initialize Telegram bot:', error);
    throw error;
  }
};

const getBot = () => {
  if (!bot) {
    throw new Error('Bot not initialized. Call initializeBot() first.');
  }
  return bot;
};

module.exports = { initializeBot, getBot };