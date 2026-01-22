// Test setup file
// This file runs before each test suite

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock external services for testing
jest.mock('node-telegram-bot-api');
jest.mock('axios');