const logger = require('../utils/logger');

class BaseService {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.logger = logger.child({ service: serviceName });
  }

  /**
   * Handle service errors with consistent logging and error formatting
   * @param {Error} error - The error to handle
   * @param {string} operation - The operation that failed
   * @param {Object} context - Additional context for debugging
   * @throws {Error} - Formatted error with service context
   */
  handleError(error, operation, context = {}) {
    const errorMessage = `${this.serviceName} - ${operation} failed`;
    
    this.logger.error(errorMessage, {
      error: error.message,
      stack: error.stack,
      operation,
      context
    });

    // Create a new error with service context
    const serviceError = new Error(`${errorMessage}: ${error.message}`);
    serviceError.originalError = error;
    serviceError.service = this.serviceName;
    serviceError.operation = operation;
    serviceError.context = context;
    
    throw serviceError;
  }

  /**
   * Log service operations for debugging and monitoring
   * @param {string} operation - The operation being performed
   * @param {Object} data - Data related to the operation
   */
  logOperation(operation, data = {}) {
    this.logger.info(`${this.serviceName} - ${operation}`, data);
  }

  /**
   * Validate required parameters for service methods
   * @param {Object} params - Parameters to validate
   * @param {Array} required - Array of required parameter names
   * @throws {Error} - If required parameters are missing
   */
  validateRequired(params, required) {
    const missing = required.filter(param => 
      params[param] === undefined || params[param] === null
    );

    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Execute a service operation with error handling and logging
   * @param {string} operation - Name of the operation
   * @param {Function} fn - Function to execute
   * @param {Object} context - Context for logging
   * @returns {Promise} - Result of the operation
   */
  async executeOperation(operation, fn, context = {}) {
    try {
      this.logOperation(operation, context);
      const result = await fn();
      this.logger.debug(`${this.serviceName} - ${operation} completed successfully`);
      return result;
    } catch (error) {
      this.handleError(error, operation, context);
    }
  }
}

module.exports = BaseService;