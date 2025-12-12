import pino from 'pino';

// Create logger instance with pretty printing in development
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false,
      messageFormat: '{levelLabel} - {msg}'
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    }
  }
});

// Helper functions for common logging patterns
export const logRequest = (method: string, path: string, duration?: number) => {
  if (duration !== undefined) {
    logger.info({ method, path, duration }, `${method} ${path} - ${duration}ms`);
  } else {
    logger.info({ method, path }, `${method} ${path}`);
  }
};

export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    ...context
  }, error.message);
};

export const logChat = (messageCount: number, extractedInfo: any, assigned: boolean) => {
  logger.info({
    messageCount,
    extractedInfo,
    assigned
  }, `Chat processed - ${messageCount} messages, assigned: ${assigned}`);
};

export const logFuzzyMatch = (original: string, matched: string, confidence: number) => {
  logger.debug({
    original,
    matched,
    confidence
  }, `Fuzzy matched: "${original}" → "${matched}" (${confidence.toFixed(2)})`);
};

export const logRuleMatch = (ruleId: string, ruleName: string, assignee: string) => {
  logger.info({
    ruleId,
    ruleName,
    assignee
  }, `Rule matched: "${ruleName}" → ${assignee}`);
};

export const logDatabaseOperation = (operation: string, table: string, duration: number, success: boolean) => {
  const logFunc = success ? logger.debug : logger.error;
  logFunc({
    operation,
    table,
    duration,
    success
  }, `DB ${operation} on ${table} - ${duration}ms - ${success ? 'success' : 'failed'}`);
};

export default logger;
