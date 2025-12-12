import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import logger, { logRequest, logError } from './logger';
import metrics from './metrics';

/**
 * Request logging middleware with metrics tracking
 * Logs all incoming requests with timing and tracks metrics
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Log request
  logger.info({
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip
  }, `→ ${req.method} ${req.path}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';

    logger[logLevel]({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    }, `← ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);

    // Track metrics
    metrics.trackRequest({
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      duration
    });

    // Track errors
    if (res.statusCode >= 400) {
      metrics.trackError({
        endpoint: req.path,
        method: req.method,
        errorType: res.statusCode >= 500 ? 'ServerError' : 'ClientError',
        errorMessage: res.statusMessage || 'Unknown error'
      });
    }
  });

  next();
};

/**
 * Global error handler middleware
 * Catches all unhandled errors and returns consistent error responses
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logError(err, {
    method: req.method,
    path: req.path,
    query: req.query
  });

  // Track error in metrics
  metrics.trackError({
    endpoint: req.path,
    method: req.method,
    errorType: err.name,
    errorMessage: err.message
  });

  // Don't send error if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  // Determine status code
  const statusCode = (err as any).statusCode || 500;

  // SECURITY: Never expose implementation details in production
  // Map internal errors to generic messages
  const getPublicErrorMessage = (err: Error, statusCode: number): string => {
    // In development, show actual error
    if (process.env.NODE_ENV !== 'production') {
      return err.message;
    }

    // In production, use generic messages
    switch (statusCode) {
      case 400:
        return 'Invalid request data';
      case 401:
        return 'Authentication required';
      case 403:
        return 'Access denied';
      case 404:
        return 'Resource not found';
      case 429:
        return 'Too many requests';
      case 500:
      default:
        return 'An error occurred processing your request';
    }
  };

  // Send error response (NO stack traces in production)
  res.status(statusCode).json({
    error: {
      message: getPublicErrorMessage(err, statusCode),
      type: 'Error', // Don't expose error type in production
      code: statusCode
    }
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn({
    method: req.method,
    path: req.path
  }, `404 Not Found: ${req.method} ${req.path}`);

  metrics.trackError({
    endpoint: req.path,
    method: req.method,
    errorType: 'NotFound',
    errorMessage: `Route ${req.method} ${req.path} not found`
  });

  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      type: 'NotFound'
    }
  });
};

/**
 * Rate limiting for chat endpoint
 * Prevents abuse by limiting requests per IP
 */
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per IP
  message: {
    error: {
      message: 'Too many requests, please try again later',
      type: 'RateLimitExceeded'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({
      ip: req.ip,
      path: req.path
    }, `Rate limit exceeded for ${req.ip}`);

    metrics.trackError({
      endpoint: req.path,
      method: req.method,
      errorType: 'RateLimitExceeded',
      errorMessage: `Rate limit exceeded for IP: ${req.ip}`
    });

    res.status(429).json({
      error: {
        message: 'Too many chat requests. Please wait a moment before trying again.',
        type: 'RateLimitExceeded',
        retryAfter: '60 seconds'
      }
    });
  }
});

/**
 * Rate limiting for API endpoints
 * More lenient than chat endpoint
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    error: {
      message: 'Too many API requests, please try again later',
      type: 'RateLimitExceeded'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health and metrics endpoints
    return req.path === '/health' || req.path === '/metrics' || req.path.startsWith('/api-docs');
  },
  handler: (req, res) => {
    logger.warn({
      ip: req.ip,
      path: req.path
    }, `API rate limit exceeded for ${req.ip}`);

    metrics.trackError({
      endpoint: req.path,
      method: req.method,
      errorType: 'RateLimitExceeded',
      errorMessage: `API rate limit exceeded for IP: ${req.ip}`
    });

    res.status(429).json({
      error: {
        message: 'Too many API requests. Please wait before trying again.',
        type: 'RateLimitExceeded',
        retryAfter: '60 seconds'
      }
    });
  }
});

/**
 * Request validation middleware for chat endpoint
 */
export const validateChatRequest = (req: Request, res: Response, next: NextFunction) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    logger.warn({
      body: req.body
    }, 'Invalid chat request: missing or invalid messages array');

    return res.status(400).json({
      error: {
        message: 'Request must include a messages array',
        type: 'ValidationError',
        field: 'messages'
      }
    });
  }

  if (messages.length === 0) {
    logger.warn('Invalid chat request: empty messages array');

    return res.status(400).json({
      error: {
        message: 'Messages array cannot be empty',
        type: 'ValidationError',
        field: 'messages'
      }
    });
  }

  if (messages.length > 50) {
    logger.warn({
      messageCount: messages.length
    }, 'Invalid chat request: too many messages');

    return res.status(400).json({
      error: {
        message: 'Too many messages in conversation (max 50)',
        type: 'ValidationError',
        field: 'messages'
      }
    });
  }

  next();
};

/**
 * Request validation middleware for rule creation/update
 */
export const validateRuleRequest = (req: Request, res: Response, next: NextFunction) => {
  const { name, conditions, assignee, priority } = req.body;

  const errors: string[] = [];

  if (req.method === 'POST' || (req.method === 'PUT' && name !== undefined)) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push('name must be a non-empty string');
    }
  }

  if (req.method === 'POST' || (req.method === 'PUT' && conditions !== undefined)) {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      errors.push('conditions must be a non-empty array');
    } else {
      conditions.forEach((cond, i) => {
        if (!cond.field || !cond.operator || !cond.value) {
          errors.push(`condition[${i}] missing required fields (field, operator, value)`);
        }
        if (!['equals', 'contains'].includes(cond.operator)) {
          errors.push(`condition[${i}] operator must be 'equals' or 'contains'`);
        }
      });
    }
  }

  if (req.method === 'POST' || (req.method === 'PUT' && assignee !== undefined)) {
    if (!assignee || typeof assignee !== 'string' || !assignee.includes('@')) {
      errors.push('assignee must be a valid email address');
    }
  }

  if (req.method === 'POST' || (req.method === 'PUT' && priority !== undefined)) {
    if (typeof priority !== 'number' || priority < 1) {
      errors.push('priority must be a number >= 1');
    }
  }

  if (errors.length > 0) {
    logger.warn({
      errors,
      body: req.body
    }, 'Rule validation failed');

    return res.status(400).json({
      error: {
        message: 'Validation failed',
        type: 'ValidationError',
        details: errors
      }
    });
  }

  next();
};
