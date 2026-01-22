const NLPService = require('../../src/services/NLPService');
const { nlpTestExamples, nigerianContextExamples } = require('../../src/utils/nlpExamples');

// This test requires actual OpenRouter API key and should be run separately
// Skip by default to avoid API calls in regular test runs
describe.skip('NLPService Integration Tests', () => {
  let nlpService;

  beforeAll(() => {
    // Ensure API key is set for integration tests
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY required for integration tests');
    }
    
    nlpService = new NLPService();
  });

  describe('Real API Service Request Parsing', () => {
    test('should parse plumbing requests correctly', async () => {
      for (const example of nlpTestExamples.plumbing) {
        const result = await nlpService.parseServiceRequest(example.message);
        
        expect(result.serviceType).toBe('plumbing');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.description).toBeTruthy();
        
        console.log(`✓ Parsed: "${example.message}" -> ${result.serviceType} (${result.confidence})`);
      }
    }, 30000); // 30 second timeout for API calls

    test('should parse electrical requests correctly', async () => {
      for (const example of nlpTestExamples.electrical) {
        const result = await nlpService.parseServiceRequest(example.message);
        
        expect(result.serviceType).toBe('electrical');
        expect(result.confidence).toBeGreaterThan(0.5);
        
        console.log(`✓ Parsed: "${example.message}" -> ${result.serviceType} (${result.confidence})`);
      }
    }, 30000);

    test('should handle ambiguous requests', async () => {
      for (const example of nlpTestExamples.ambiguous) {
        const result = await nlpService.parseServiceRequest(example.message);
        
        // Should either classify correctly or have low confidence
        expect(result.confidence).toBeLessThan(0.8);
        
        console.log(`✓ Parsed ambiguous: "${example.message}" -> ${result.serviceType} (${result.confidence})`);
      }
    }, 30000);
  });

  describe('Nigerian Context Understanding', () => {
    test('should understand Nigerian English and Pidgin', async () => {
      for (const example of nigerianContextExamples) {
        const result = await nlpService.parseServiceRequest(example.message);
        
        expect(result.serviceType).toBe(example.expected.serviceType);
        expect(result.confidence).toBeGreaterThan(0.4); // Lower threshold for pidgin
        
        console.log(`✓ Nigerian context: "${example.message}" -> ${result.serviceType} (${result.confidence})`);
      }
    }, 30000);
  });

  describe('Intent Classification', () => {
    test('should classify user intents correctly', async () => {
      for (const example of nlpTestExamples.intents) {
        const result = await nlpService.classifyUserIntent(example.message);
        
        expect(result.intent).toBe(example.expected.intent);
        expect(result.confidence).toBeGreaterThan(0.5);
        
        console.log(`✓ Intent: "${example.message}" -> ${result.intent} (${result.confidence})`);
      }
    }, 30000);
  });

  describe('Artisan Suggestions', () => {
    test('should generate contextual suggestions', async () => {
      const mockArtisans = [
        {
          fullName: 'Emeka Okafor',
          tier: { current: 'Elite' },
          metrics: { averageRating: 4.9 },
          businessInfo: { yearsExperience: 15 }
        },
        {
          fullName: 'Fatima Ibrahim',
          tier: { current: 'Professional' },
          metrics: { averageRating: 4.6 },
          businessInfo: { yearsExperience: 8 }
        },
        {
          fullName: 'John Adebayo',
          tier: { current: 'Foundation' },
          metrics: { averageRating: 4.2 },
          businessInfo: { yearsExperience: 3 }
        }
      ];

      const parsedRequest = {
        serviceType: 'plumbing',
        urgency: 'high',
        description: 'Emergency pipe burst in kitchen'
      };

      const result = await nlpService.generateArtisanSuggestions(parsedRequest, mockArtisans);
      
      expect(result.suggestions).toHaveLength(3);
      expect(result.explanation).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0.5);
      
      // Elite tier should be recommended first
      expect(result.suggestions[0].tier.current).toBe('Elite');
      
      console.log(`✓ Suggestions: ${result.explanation}`);
    }, 15000);
  });

  describe('Clarifying Questions', () => {
    test('should generate helpful clarifying questions', async () => {
      const unclearRequest = {
        serviceType: 'other',
        description: 'Something is broken',
        confidence: 0.2
      };

      const question = await nlpService.generateClarifyingQuestion(unclearRequest);
      
      expect(question).toBeTruthy();
      expect(question.length).toBeLessThan(200); // Should be concise
      expect(question).toMatch(/\?$/); // Should end with question mark
      
      console.log(`✓ Clarifying question: "${question}"`);
    }, 15000);
  });

  describe('Service Health', () => {
    test('should check OpenRouter service availability', async () => {
      const isHealthy = await nlpService.checkServiceHealth();
      
      expect(isHealthy).toBe(true);
      console.log('✓ OpenRouter service is healthy');
    }, 15000);
  });

  describe('Error Handling and Fallbacks', () => {
    test('should handle rate limiting gracefully', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array.from({ length: 5 }, (_, i) => 
        nlpService.parseServiceRequest(`Test message ${i + 1}`)
      );

      const results = await Promise.allSettled(promises);
      
      // At least some should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
      
      console.log(`✓ Rate limiting test: ${successful.length}/5 requests succeeded`);
    }, 30000);

    test('should fallback when confidence is low', async () => {
      const vagueMesage = "fix thing please help me now urgent";
      
      const result = await nlpService.parseServiceRequest(vagueMesage);
      
      // Should still return a result even if confidence is low
      expect(result).toBeTruthy();
      expect(result.serviceType).toBeTruthy();
      
      if (result.confidence < 0.5) {
        const question = await nlpService.generateClarifyingQuestion(result);
        expect(question).toBeTruthy();
        console.log(`✓ Low confidence fallback: "${question}"`);
      }
    }, 15000);
  });

  describe('Performance Tests', () => {
    test('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      await nlpService.parseServiceRequest('My kitchen sink is leaking');
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(10000); // Should respond within 10 seconds
      
      console.log(`✓ Response time: ${responseTime}ms`);
    });

    test('should handle concurrent requests', async () => {
      const messages = [
        'Fix my toilet',
        'Install ceiling fan',
        'Paint my room',
        'Clean my house'
      ];

      const startTime = Date.now();
      
      const promises = messages.map(msg => nlpService.parseServiceRequest(msg));
      const results = await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.serviceType).toBeTruthy();
      });
      
      console.log(`✓ Concurrent requests: ${totalTime}ms for ${messages.length} requests`);
    }, 30000);
  });
});

// Helper function to run integration tests manually
async function runManualTests() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('Set OPENROUTER_API_KEY environment variable to run integration tests');
    return;
  }

  const nlpService = new NLPService();
  
  console.log('🧪 Running NLP Service Integration Tests...\n');

  // Test basic parsing
  console.log('📝 Testing Service Request Parsing:');
  const testMessages = [
    'My kitchen pipe is leaking badly',
    'Need electrician for power socket repair',
    'Want to paint my bedroom walls',
    'House cleaning service needed'
  ];

  for (const message of testMessages) {
    try {
      const result = await nlpService.parseServiceRequest(message);
      console.log(`✅ "${message}" -> ${result.serviceType} (confidence: ${result.confidence})`);
    } catch (error) {
      console.log(`❌ "${message}" -> Error: ${error.message}`);
    }
  }

  // Test health check
  console.log('\n🏥 Testing Service Health:');
  try {
    const isHealthy = await nlpService.checkServiceHealth();
    console.log(`✅ OpenRouter service is ${isHealthy ? 'healthy' : 'unhealthy'}`);
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
  }

  console.log('\n✨ Integration tests completed!');
}

// Export the manual test function
module.exports = { runManualTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runManualTests().catch(console.error);
}