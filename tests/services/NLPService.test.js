const NLPService = require('../../src/services/NLPService');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('NLPService', () => {
  let nlpService;

  beforeAll(() => {
    // Set required environment variables
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    process.env.OPENROUTER_MODEL = 'anthropic/claude-3-haiku';
  });

  beforeEach(() => {
    nlpService = new NLPService();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with required environment variables', () => {
      expect(nlpService.openRouterApiKey).toBe('test-api-key');
      expect(nlpService.model).toBe('anthropic/claude-3-haiku');
    });

    test('should throw error if API key is missing', () => {
      delete process.env.OPENROUTER_API_KEY;
      expect(() => new NLPService()).toThrow('OPENROUTER_API_KEY environment variable is required');
      process.env.OPENROUTER_API_KEY = 'test-api-key'; // Restore for other tests
    });
  });

  describe('makeOpenRouterRequest', () => {
    test('should make successful API request', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: 'Test response'
            }
          }]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await nlpService.makeOpenRouterRequest(messages);

      expect(result).toBe('Test response');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          model: 'anthropic/claude-3-haiku',
          messages: messages,
          max_tokens: 500,
          temperature: 0.1
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          }),
          timeout: 30000
        })
      );
    });

    test('should handle API errors', async () => {
      const mockError = new Error('API Error');
      mockError.response = {
        status: 500,
        data: { error: 'Internal server error' }
      };

      mockedAxios.post.mockRejectedValue(mockError);

      const messages = [{ role: 'user', content: 'Hello' }];
      
      await expect(nlpService.makeOpenRouterRequest(messages))
        .rejects.toThrow('OpenRouter API request failed: API Error');
    });
  });

  describe('parseServiceRequest', () => {
    test('should parse valid service request', async () => {
      const mockLLMResponse = JSON.stringify({
        serviceType: 'plumbing',
        urgency: 'high',
        description: 'Fix leaking kitchen pipe',
        location: null,
        timePreference: 'morning',
        budget: null,
        confidence: 0.9
      });

      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{
            message: { content: mockLLMResponse }
          }]
        }
      });

      const result = await nlpService.parseServiceRequest('My kitchen pipe is leaking badly');

      expect(result.serviceType).toBe('plumbing');
      expect(result.urgency).toBe('high');
      expect(result.description).toBe('Fix leaking kitchen pipe');
      expect(result.confidence).toBe(0.9);
    });

    test('should handle invalid service type from LLM', async () => {
      const mockLLMResponse = JSON.stringify({
        serviceType: 'invalid_service',
        urgency: 'medium',
        description: 'Some work needed',
        location: null,
        timePreference: null,
        budget: null,
        confidence: 0.8
      });

      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{
            message: { content: mockLLMResponse }
          }]
        }
      });

      const result = await nlpService.parseServiceRequest('I need some work done');

      expect(result.serviceType).toBe('other'); // Should default to 'other'
      expect(result.confidence).toBe(0.8);
    });

    test('should fallback to rule-based parsing when LLM fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      const result = await nlpService.parseServiceRequest('My toilet is blocked');

      expect(result.serviceType).toBe('plumbing'); // Should detect from keywords
      expect(result.urgency).toBe('medium');
      expect(result.description).toBe('My toilet is blocked');
      expect(result.confidence).toBe(0.3); // Low confidence for fallback
    });

    test('should handle invalid JSON response from LLM', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{
            message: { content: 'Invalid JSON response' }
          }]
        }
      });

      const result = await nlpService.parseServiceRequest('Fix my sink');

      expect(result.serviceType).toBe('plumbing'); // Should fallback to rule-based
      expect(result.confidence).toBe(0.3);
    });

    test('should throw error for missing message', async () => {
      await expect(nlpService.parseServiceRequest())
        .rejects.toThrow('Missing required parameters');
    });
  });

  describe('fallbackParseServiceRequest', () => {
    test('should detect plumbing keywords', () => {
      const result = nlpService.fallbackParseServiceRequest('My pipe is leaking water everywhere');
      
      expect(result.serviceType).toBe('plumbing');
      expect(result.urgency).toBe('medium');
      expect(result.confidence).toBe(0.3);
    });

    test('should detect electrical keywords', () => {
      const result = nlpService.fallbackParseServiceRequest('The light switch is not working');
      
      expect(result.serviceType).toBe('electrical');
      expect(result.urgency).toBe('medium');
    });

    test('should detect urgency keywords', () => {
      const result = nlpService.fallbackParseServiceRequest('Emergency! My pipe burst!');
      
      expect(result.urgency).toBe('emergency');
    });

    test('should default to other service type', () => {
      const result = nlpService.fallbackParseServiceRequest('I need some random help');
      
      expect(result.serviceType).toBe('other');
      expect(result.urgency).toBe('medium');
    });
  });

  describe('generateArtisanSuggestions', () => {
    const mockArtisans = [
      {
        fullName: 'John Smith',
        tier: { current: 'Elite' },
        metrics: { averageRating: 4.8 },
        businessInfo: { yearsExperience: 10 }
      },
      {
        fullName: 'Jane Doe',
        tier: { current: 'Professional' },
        metrics: { averageRating: 4.5 },
        businessInfo: { yearsExperience: 7 }
      }
    ];

    const mockParsedRequest = {
      serviceType: 'plumbing',
      urgency: 'high',
      description: 'Fix leaking pipe'
    };

    test('should generate suggestions with LLM explanation', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{
            message: { content: 'John Smith is highly recommended for urgent plumbing work.' }
          }]
        }
      });

      const result = await nlpService.generateArtisanSuggestions(mockParsedRequest, mockArtisans);

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].fullName).toBe('John Smith'); // Elite tier should be first
      expect(result.explanation).toContain('John Smith');
      expect(result.confidence).toBe(0.8);
    });

    test('should handle empty artisan list', async () => {
      const result = await nlpService.generateArtisanSuggestions(mockParsedRequest, []);

      expect(result.suggestions).toHaveLength(0);
      expect(result.explanation).toContain('No artisans are currently available');
      expect(result.confidence).toBe(1.0);
    });

    test('should fallback when LLM fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      const result = await nlpService.generateArtisanSuggestions(mockParsedRequest, mockArtisans);

      expect(result.suggestions).toHaveLength(2);
      expect(result.explanation).toContain('John Smith');
      expect(result.confidence).toBe(0.6);
    });
  });

  describe('classifyUserIntent', () => {
    test('should classify service request intent', async () => {
      const mockResponse = JSON.stringify({
        intent: 'service_request',
        confidence: 0.9,
        entities: {
          service_type: 'plumbing'
        }
      });

      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{
            message: { content: mockResponse }
          }]
        }
      });

      const result = await nlpService.classifyUserIntent('I need a plumber to fix my sink');

      expect(result.intent).toBe('service_request');
      expect(result.confidence).toBe(0.9);
      expect(result.entities.service_type).toBe('plumbing');
    });

    test('should fallback to rule-based classification', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      const result = await nlpService.classifyUserIntent('Hello there');

      expect(result.intent).toBe('greeting');
      expect(result.confidence).toBe(0.8);
    });

    test('should handle help intent', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      const result = await nlpService.classifyUserIntent('I need help');

      expect(result.intent).toBe('help');
      expect(result.confidence).toBe(0.7);
    });
  });

  describe('generateClarifyingQuestion', () => {
    test('should generate clarifying question', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{
            message: { content: 'Could you tell me more about the plumbing issue?' }
          }]
        }
      });

      const parsedRequest = {
        serviceType: 'plumbing',
        description: 'Something is broken',
        confidence: 0.3
      };

      const result = await nlpService.generateClarifyingQuestion(parsedRequest);

      expect(result).toContain('plumbing issue');
    });

    test('should fallback to predefined questions', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      const parsedRequest = {
        serviceType: 'electrical',
        description: 'Something is broken',
        confidence: 0.3
      };

      const result = await nlpService.generateClarifyingQuestion(parsedRequest);

      expect(result).toContain('electrical work');
    });
  });

  describe('sanitizeLLMOutput', () => {
    test('should remove code block markers', () => {
      const input = '```json\n{"test": "value"}\n```';
      const result = nlpService.sanitizeLLMOutput(input);
      
      expect(result).toBe('{"test": "value"}');
    });

    test('should limit output length', () => {
      const longInput = 'a'.repeat(1500);
      const result = nlpService.sanitizeLLMOutput(longInput);
      
      expect(result.length).toBe(1003); // 1000 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    test('should handle invalid input', () => {
      expect(nlpService.sanitizeLLMOutput(null)).toBe('');
      expect(nlpService.sanitizeLLMOutput(undefined)).toBe('');
      expect(nlpService.sanitizeLLMOutput(123)).toBe('');
    });
  });

  describe('checkServiceHealth', () => {
    test('should return true when service is healthy', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{
            message: { content: 'Hello' }
          }]
        }
      });

      const result = await nlpService.checkServiceHealth();
      expect(result).toBe(true);
    });

    test('should return false when service is unhealthy', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Service unavailable'));

      const result = await nlpService.checkServiceHealth();
      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should handle missing required parameters', async () => {
      await expect(nlpService.parseServiceRequest())
        .rejects.toThrow('Missing required parameters');
    });

    test('should handle network timeouts', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.code = 'ECONNABORTED';
      mockedAxios.post.mockRejectedValue(timeoutError);

      await expect(nlpService.parseServiceRequest('test message'))
        .rejects.toThrow('OpenRouter API request failed');
    });
  });
});