/**
 * Input sanitization utilities for user messages and LLM outputs
 */

/**
 * Sanitize user input messages
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized input
 */
function sanitizeUserInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove potentially harmful characters and normalize
  let sanitized = input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .substring(0, 1000); // Limit length

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Validate message content for appropriate service requests
 * @param {string} message - User message
 * @returns {Object} - Validation result
 */
function validateMessageContent(message) {
  const sanitized = sanitizeUserInput(message);
  
  if (!sanitized) {
    return {
      isValid: false,
      reason: 'Empty message',
      sanitized: ''
    };
  }

  if (sanitized.length < 3) {
    return {
      isValid: false,
      reason: 'Message too short',
      sanitized
    };
  }

  // Check for spam patterns
  const spamPatterns = [
    /(.)\1{10,}/, // Repeated characters
    /^[^a-zA-Z0-9\s]{5,}$/, // Only special characters
    /(https?:\/\/[^\s]+){3,}/, // Multiple URLs
    /\b(buy|sell|cheap|free|money|cash|loan|credit)\b.*\b(now|today|urgent)\b/i // Spam keywords
  ];

  for (const pattern of spamPatterns) {
    if (pattern.test(sanitized)) {
      return {
        isValid: false,
        reason: 'Potential spam content',
        sanitized
      };
    }
  }

  // Check for inappropriate content
  const inappropriatePatterns = [
    /\b(fuck|shit|damn|bitch|asshole|bastard)\b/i,
    /\b(sex|porn|nude|naked)\b/i,
    /\b(kill|murder|die|death|suicide)\b/i
  ];

  for (const pattern of inappropriatePatterns) {
    if (pattern.test(sanitized)) {
      return {
        isValid: false,
        reason: 'Inappropriate content',
        sanitized
      };
    }
  }

  return {
    isValid: true,
    reason: null,
    sanitized
  };
}

/**
 * Sanitize LLM output for safe display
 * @param {string} output - Raw LLM output
 * @returns {string} - Sanitized output
 */
function sanitizeLLMOutput(output) {
  if (!output || typeof output !== 'string') {
    return '';
  }

  // Remove code blocks and potential injection attempts
  let sanitized = output
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, '') // Remove inline code
    .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .trim();

  // Limit length and normalize whitespace
  sanitized = sanitized
    .substring(0, 2000)
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized;
}

/**
 * Extract and validate JSON from LLM response
 * @param {string} response - Raw LLM response
 * @returns {Object|null} - Parsed JSON or null if invalid
 */
function extractValidJSON(response) {
  if (!response || typeof response !== 'string') {
    return null;
  }

  try {
    // Try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    // Basic validation - must be an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

/**
 * Validate service request parsing result
 * @param {Object} parsed - Parsed service request
 * @returns {boolean} - Whether the result is valid
 */
function validateServiceRequestResult(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }

  // Required fields
  const requiredFields = ['serviceType', 'description', 'urgency', 'confidence'];
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      return false;
    }
  }

  // Validate field types and values
  if (typeof parsed.serviceType !== 'string' || !parsed.serviceType) {
    return false;
  }

  if (typeof parsed.description !== 'string' || !parsed.description) {
    return false;
  }

  if (!['low', 'medium', 'high', 'emergency'].includes(parsed.urgency)) {
    return false;
  }

  if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
    return false;
  }

  return true;
}

/**
 * Validate intent classification result
 * @param {Object} classified - Classified intent
 * @returns {boolean} - Whether the result is valid
 */
function validateIntentResult(classified) {
  if (!classified || typeof classified !== 'object') {
    return false;
  }

  // Required fields
  if (!classified.intent || typeof classified.intent !== 'string') {
    return false;
  }

  if (typeof classified.confidence !== 'number' || classified.confidence < 0 || classified.confidence > 1) {
    return false;
  }

  // Valid intents
  const validIntents = [
    'service_request', 'location_update', 'view_bookings', 
    'cancel_booking', 'rate_service', 'help', 'greeting', 'other'
  ];

  if (!validIntents.includes(classified.intent)) {
    return false;
  }

  return true;
}

/**
 * Rate limit check for user requests
 * @param {string} userId - User identifier
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} - Rate limit status
 */
const rateLimitStore = new Map();

function checkRateLimit(userId, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const userKey = `rate_limit_${userId}`;
  
  if (!rateLimitStore.has(userKey)) {
    rateLimitStore.set(userKey, {
      requests: 1,
      resetTime: now + windowMs
    });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }

  const userData = rateLimitStore.get(userKey);
  
  // Reset if window has passed
  if (now > userData.resetTime) {
    rateLimitStore.set(userKey, {
      requests: 1,
      resetTime: now + windowMs
    });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }

  // Check if limit exceeded
  if (userData.requests >= maxRequests) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetTime: userData.resetTime,
      retryAfter: userData.resetTime - now
    };
  }

  // Increment counter
  userData.requests++;
  rateLimitStore.set(userKey, userData);

  return { 
    allowed: true, 
    remaining: maxRequests - userData.requests, 
    resetTime: userData.resetTime 
  };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimit() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up rate limit store every 5 minutes
setInterval(cleanupRateLimit, 5 * 60 * 1000);

module.exports = {
  sanitizeUserInput,
  validateMessageContent,
  sanitizeLLMOutput,
  extractValidJSON,
  validateServiceRequestResult,
  validateIntentResult,
  checkRateLimit,
  cleanupRateLimit
};