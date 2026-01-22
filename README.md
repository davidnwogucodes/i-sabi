# Telegram Artisan Marketplace

A Telegram-based marketplace for connecting users with verified artisans (electricians, plumbers, carpenters, cleaners, etc.).

## Features

- Conversational service discovery through Telegram bot
- Artisan tier system (Foundation, Professional, Elite)
- Portfolio showcases with mobile-optimized web pages
- Natural language processing for service requests
- Booking and scheduling system
- Bank transfer payment coordination
- Rating and review system

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose
- **Bot Interface**: Telegram Bot API
- **NLP**: OpenRouter API (Claude/GPT models)
- **Frontend**: EJS templates for portfolio pages

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your credentials:
   - MongoDB connection string
   - Telegram bot token
   - OpenRouter API key

4. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── app.js              # Main application entry point
├── config/             # Configuration files
├── models/             # MongoDB schemas
├── services/           # Business logic services
├── routes/             # Express routes
├── utils/              # Utility functions
└── views/              # EJS templates
```

## Development

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## API Endpoints

- `GET /health` - Health check
- `GET /portfolio/:artisanId` - Artisan portfolio page

## Bot Commands

- `/start` - Initialize bot and show service categories