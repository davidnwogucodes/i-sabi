const BaseService = require('./BaseService');
const axios = require('axios');
const { validateServiceType } = require('../config/database');
const { 
  sanitizeUserInput, 
  validateMessageContent, 
  sanitizeLLMOutput,
  extractValidJSON,
  validateServiceRequestResult,
  validateIntentResult,
  checkRateLimit
} = require('../utils/inputSanitizer');

class NLPService extends BaseService {
  constructor() {
    super('NLPService');
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku';
    this.baseURL = 'https://openrouter.ai/api/v1';
    
    if (!this.openRouterApiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }
  }

  /**
   * Make a request to OpenRouter API
   * @param {Array} messages - Array of message objects
   * @param {number} maxTokens - Maximum tokens for response
   * @returns {Promise<string>} - LLM response
   */
  async makeOpenRouterRequest(messages, maxTokens = 500) {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: messages,
          max_tokens: maxTokens,
          temperature: 0.1, // Low temperature for consistent parsing
          top_p: 0.9
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://telegram-artisan-marketplace.com',
            'X-Title': 'Telegram Artisan Marketplace'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error('OpenRouter API request failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`OpenRouter API request failed: ${error.message}`);
    }
  }

  /**
   * Parse service request from natural language
   * @param {string} message - User's natural language message
   * @param {Object} context - Additional context (location, user preferences, etc.)
   * @param {string} userId - User identifier for rate limiting
   * @returns {Promise<Object>} - Parsed service request
   */
  async parseServiceRequest(message, context = {}, userId = null) {
    return this.executeOperation('parseServiceRequest', async () => {
      this.validateRequired({ message }, ['message']);

      // Rate limiting check
      if (userId) {
        const rateLimit = checkRateLimit(userId, 20, 60000); // 20 requests per minute
        if (!rateLimit.allowed) {
          throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateLimit.retryAfter / 1000)} seconds`);
        }
      }

      // Sanitize and validate input
      const validation = validateMessageContent(message);
      if (!validation.isValid) {
        throw new Error(`Invalid message: ${validation.reason}`);
      }

      const sanitizedMessage = validation.sanitized;

      const systemPrompt = `You are an AI assistant for a Nigerian artisan marketplace. Parse user requests for home services and extract structured information.

Available service types: plumbing, electrical, carpentry, cleaning, painting, hvac, landscaping, other

Extract the following information from the user's message:
1. serviceType: The type of service needed (must be one of the available types)
2. urgency: low, medium, high, or emergency
3. description: A clear description of what needs to be done
4. location: Any location details mentioned
5. timePreference: Any time preferences mentioned
6. budget: Any budget information mentioned
7. confidence: Your confidence level (0.0 to 1.0) in the parsing

Respond ONLY with valid JSON in this exact format:
{
  "serviceType": "plumbing",
  "urgency": "medium",
  "description": "Fix leaking kitchen pipe",
  "location": null,
  "timePreference": null,
  "budget": null,
  "confidence": 0.85
}

If you cannot determine the service type, use "other" and include details in the description.
If urgency is not clear, use "medium".
Set confidence based on how clear and specific the request is.`;

      const userMessage = `User request: "${sanitizedMessage}"
${context.userLocation ? `User location: ${context.userLocation}` : ''}
${context.preferences ? `User preferences: ${JSON.stringify(context.preferences)}` : ''}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      const response = await this.makeOpenRouterRequest(messages, 300);
      const sanitizedResponse = sanitizeLLMOutput(response);
      
      try {
        const parsed = extractValidJSON(sanitizedResponse);
        
        if (!parsed || !validateServiceRequestResult(parsed)) {
          throw new Error('Invalid response format from LLM');
        }

        // Validate service type
        if (!validateServiceType(parsed.serviceType)) {
          this.logger.warn('Invalid service type from LLM, defaulting to "other"', {
            originalServiceType: parsed.serviceType,
            message
          });
          parsed.serviceType = 'other';
        }

        // Ensure confidence is within valid range
        parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

        this.logOperation('serviceRequestParsed', {
          originalMessage: sanitizedMessage,
          parsedServiceType: parsed.serviceType,
          urgency: parsed.urgency,
          confidence: parsed.confidence
        });

        return parsed;
      } catch (parseError) {
        this.logger.error('Failed to parse LLM response', {
          response: sanitizedResponse,
          error: parseError.message
        });
        
        // Fallback to rule-based parsing
        return this.fallbackParseServiceRequest(sanitizedMessage);
      }
    }, { message: sanitizedMessage, context });
  }

  /**
   * Fallback rule-based parsing when LLM fails
   * @param {string} message - User's message
   * @returns {Object} - Basic parsed request
   */
  fallbackParseServiceRequest(message) {
    const lowerMessage = message.toLowerCase();
    
    // Simple keyword matching for service types
    const serviceKeywords = {
      plumbing: ['plumb', 'pipe', 'leak', 'drain', 'toilet', 'sink', 'faucet', 'water'],
      electrical: ['electric', 'wire', 'light', 'socket', 'power', 'switch', 'bulb'],
      carpentry: ['wood', 'door', 'window', 'cabinet', 'furniture', 'shelf'],
      cleaning: ['clean', 'wash', 'mop', 'sweep', 'tidy', 'dust'],
      painting: ['paint', 'color', 'wall', 'brush', 'coat'],
      hvac: ['air', 'condition', 'heat', 'cool', 'ac', 'hvac', 'ventilation'],
      landscaping: ['garden', 'grass', 'tree', 'plant', 'landscape', 'lawn']
    };

    let detectedService = 'other';
    for (const [service, keywords] of Object.entries(serviceKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        detectedService = service;
        break;
      }
    }

    // Simple urgency detection
    let urgency = 'medium';
    if (lowerMessage.includes('emergency') || lowerMessage.includes('urgent') || lowerMessage.includes('asap')) {
      urgency = 'emergency';
    } else if (lowerMessage.includes('soon') || lowerMessage.includes('quickly')) {
      urgency = 'high';
    } else if (lowerMessage.includes('whenever') || lowerMessage.includes('no rush')) {
      urgency = 'low';
    }

    this.logOperation('fallbackParsing', {
      message,
      detectedService,
      urgency
    });

    return {
      serviceType: detectedService,
      urgency,
      description: message,
      location: null,
      timePreference: null,
      budget: null,
      confidence: 0.3 // Low confidence for fallback parsing
    };
  }

  /**
   * Generate contextual artisan suggestions
   * @param {Object} parsedRequest - Parsed service request
   * @param {Array} availableArtisans - List of available artisans
   * @returns {Promise<Object>} - Suggestions with explanations
   */
  async generateArtisanSuggestions(parsedRequest, availableArtisans) {
    return this.executeOperation('generateArtisanSuggestions', async () => {
      this.validateRequired({ parsedRequest, availableArtisans }, ['parsedRequest', 'availableArtisans']);

      if (availableArtisans.length === 0) {
        return {
          suggestions: [],
          explanation: "No artisans are currently available in your area for this service.",
          confidence: 1.0
        };
      }

      const systemPrompt = `You are an AI assistant helping users choose the best artisan for their needs. 

Analyze the user's request and the available artisans, then provide personalized recommendations.

Consider these factors:
1. Service type match
2. Artisan tier (Elite > Professional > Foundation)
3. Rating and experience
4. Urgency of the request
5. Location proximity

Provide a brief, helpful explanation for why these artisans are recommended.
Keep the explanation conversational and under 100 words.`;

      const userMessage = `User needs: ${parsedRequest.description}
Service type: ${parsedRequest.serviceType}
Urgency: ${parsedRequest.urgency}

Available artisans:
${availableArtisans.map((artisan, index) => 
  `${index + 1}. ${artisan.fullName} - ${artisan.tier.current} tier, ${artisan.metrics.averageRating}/5 rating, ${artisan.businessInfo.yearsExperience} years experience`
).join('\n')}

Provide a recommendation explanation focusing on the top 3-5 artisans.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      try {
        const explanation = await this.makeOpenRouterRequest(messages, 200);
        
        // Sort artisans by relevance (tier, rating, experience)
        const sortedArtisans = availableArtisans.sort((a, b) => {
          const tierScore = { Elite: 3, Professional: 2, Foundation: 1 };
          const aScore = (tierScore[a.tier.current] || 1) * 10 + a.metrics.averageRating + (a.businessInfo.yearsExperience * 0.1);
          const bScore = (tierScore[b.tier.current] || 1) * 10 + b.metrics.averageRating + (b.businessInfo.yearsExperience * 0.1);
          return bScore - aScore;
        });

        this.logOperation('suggestionsGenerated', {
          serviceType: parsedRequest.serviceType,
          artisanCount: availableArtisans.length,
          topArtisan: sortedArtisans[0]?.fullName
        });

        return {
          suggestions: sortedArtisans,
          explanation: explanation.trim(),
          confidence: 0.8
        };
      } catch (error) {
        this.logger.warn('Failed to generate LLM explanation, using fallback', { error: error.message });
        
        // Fallback explanation
        const topArtisan = availableArtisans[0];
        const explanation = `I found ${availableArtisans.length} artisan${availableArtisans.length > 1 ? 's' : ''} for your ${parsedRequest.serviceType} needs. ${topArtisan.fullName} is highly recommended with a ${topArtisan.tier.current} tier rating and ${topArtisan.metrics.averageRating}/5 stars.`;

        return {
          suggestions: availableArtisans,
          explanation,
          confidence: 0.6
        };
      }
    }, { parsedRequest, artisanCount: availableArtisans.length });
  }

  /**
   * Classify user intent in conversation
   * @param {string} message - User's message
   * @param {Object} conversationContext - Current conversation state
   * @param {string} userId - User identifier for rate limiting
   * @returns {Promise<Object>} - Classified intent
   */
  async classifyUserIntent(message, conversationContext = {}, userId = null) {
    return this.executeOperation('classifyUserIntent', async () => {
      this.validateRequired({ message }, ['message']);

      // Rate limiting check
      if (userId) {
        const rateLimit = checkRateLimit(userId, 30, 60000); // 30 requests per minute for intent classification
        if (!rateLimit.allowed) {
          throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateLimit.retryAfter / 1000)} seconds`);
        }
      }

      // Sanitize input
      const validation = validateMessageContent(message);
      if (!validation.isValid) {
        // For intent classification, we're more lenient with validation
        if (validation.reason === 'Inappropriate content') {
          return {
            intent: 'other',
            confidence: 0.9,
            entities: {},
            reason: 'inappropriate_content'
          };
        }
      }

      const sanitizedMessage = validation.sanitized || sanitizeUserInput(message);

      const systemPrompt = `You are an AI assistant for a Nigerian artisan marketplace. Classify the user's intent based on their message.

Possible intents:
- service_request: User wants to book a service
- location_update: User wants to set/update their location
- view_bookings: User wants to see their booking history
- cancel_booking: User wants to cancel a booking
- rate_service: User wants to rate a completed service
- help: User needs help or information
- greeting: User is greeting or starting conversation
- other: Anything else

Respond ONLY with valid JSON:
{
  "intent": "service_request",
  "confidence": 0.85,
  "entities": {
    "service_type": "plumbing",
    "location": "Lagos"
  }
}`;

      const userMessage = `User message: "${sanitizedMessage}"
${conversationContext.currentStep ? `Current conversation step: ${conversationContext.currentStep}` : ''}
${conversationContext.lastIntent ? `Previous intent: ${conversationContext.lastIntent}` : ''}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      try {
        const response = await this.makeOpenRouterRequest(messages, 200);
        const sanitizedResponse = sanitizeLLMOutput(response);
        const classified = extractValidJSON(sanitizedResponse);
        
        if (!classified || !validateIntentResult(classified)) {
          throw new Error('Invalid classification response');
        }

        classified.confidence = Math.max(0, Math.min(1, classified.confidence));

        this.logOperation('intentClassified', {
          message: sanitizedMessage,
          intent: classified.intent,
          confidence: classified.confidence
        });

        return classified;
      } catch (error) {
        this.logger.warn('Intent classification failed, using fallback', { error: error.message });
        
        // Simple fallback classification
        const lowerMessage = sanitizedMessage.toLowerCase();
        let intent = 'other';
        let confidence = 0.3;

        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('start')) {
          intent = 'greeting';
          confidence = 0.8;
        } else if (lowerMessage.includes('help')) {
          intent = 'help';
          confidence = 0.7;
        } else if (lowerMessage.includes('book') || lowerMessage.includes('need') || lowerMessage.includes('fix')) {
          intent = 'service_request';
          confidence = 0.6;
        } else if (lowerMessage.includes('location') || lowerMessage.includes('address')) {
          intent = 'location_update';
          confidence = 0.6;
        }

        return {
          intent,
          confidence,
          entities: {}
        };
      }
    }, { message: sanitizedMessage, conversationContext });
  }

  /**
   * Generate clarifying questions when request is unclear
   * @param {Object} parsedRequest - Parsed request with low confidence
   * @returns {Promise<string>} - Clarifying question
   */
  async generateClarifyingQuestion(parsedRequest) {
    return this.executeOperation('generateClarifyingQuestion', async () => {
      this.validateRequired({ parsedRequest }, ['parsedRequest']);

      const systemPrompt = `You are an AI assistant for a Nigerian artisan marketplace. The user's request was unclear. Generate a helpful clarifying question to better understand their needs.

Be conversational, friendly, and specific. Ask about the most important missing information.
Keep the question under 50 words.`;

      const userMessage = `User's unclear request: "${parsedRequest.description}"
Detected service type: ${parsedRequest.serviceType}
Confidence: ${parsedRequest.confidence}

Generate a clarifying question to better understand their needs.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      try {
        const question = await this.makeOpenRouterRequest(messages, 100);
        
        this.logOperation('clarifyingQuestionGenerated', {
          originalRequest: parsedRequest.description,
          serviceType: parsedRequest.serviceType,
          confidence: parsedRequest.confidence
        });

        return question.trim();
      } catch (error) {
        this.logger.warn('Failed to generate clarifying question, using fallback', { error: error.message });
        
        // Fallback questions based on service type
        const fallbackQuestions = {
          plumbing: "Could you tell me more about the plumbing issue? Is it a leak, blockage, or installation?",
          electrical: "What kind of electrical work do you need? Is it wiring, lighting, or appliance installation?",
          carpentry: "What carpentry work do you need done? Is it furniture, doors, windows, or something else?",
          cleaning: "What type of cleaning service do you need? Is it regular house cleaning or deep cleaning?",
          other: "Could you provide more details about what you need help with?"
        };

        return fallbackQuestions[parsedRequest.serviceType] || fallbackQuestions.other;
      }
    }, { parsedRequest });
  }

  /**
   * Sanitize and validate LLM outputs
   * @param {string} output - Raw LLM output
   * @returns {string} - Sanitized output
   */
  sanitizeLLMOutput(output) {
    if (!output || typeof output !== 'string') {
      return '';
    }

    // Remove potential harmful content
    const sanitized = output
      .replace(/```json\n?/g, '') // Remove code block markers
      .replace(/```\n?/g, '')
      .trim();

    // Limit length
    return sanitized.length > 1000 ? sanitized.substring(0, 1000) + '...' : sanitized;
  }

  /**
   * Check if OpenRouter service is available
   * @returns {Promise<boolean>} - Service availability
   */
  async checkServiceHealth() {
    try {
      const messages = [
        { role: 'user', content: 'Hello' }
      ];
      
      await this.makeOpenRouterRequest(messages, 10);
      return true;
    } catch (error) {
      this.logger.error('OpenRouter health check failed', { error: error.message });
      return false;
    }
  }
}

module.exports = NLPService;