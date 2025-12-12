import winston from 'winston';
import { ExtractedInfo } from './types';

// Create structured logger with Winston
export const observabilityLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'legal-triage' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      )
    }),
    // Log to file for persistence
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    }),
    new winston.transports.File({
      filename: 'logs/chat-trace.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// In-memory trace storage for real-time debugging (last 100 traces)
const traceStorage: ChatTrace[] = [];
const MAX_TRACES = 100;

export interface ChatTrace {
  traceId: string;
  timestamp: string;
  employeeEmail?: string;
  employeeContext?: {
    id: string;
    name: string;
    department: string;
    location: string;
    tags?: string[];
  };
  messages: Array<{ role: string; content: string }>;
  extractedInfo?: ExtractedInfo;
  fuzzyMatches?: {
    requestType?: { original: string; matched: string; confidence: number };
    location?: { original: string; matched: string; confidence: number };
    department?: { original: string; matched: string; confidence: number };
  };
  ragContext?: {
    documentsSearched: number;
    documentsRetrieved: number;
    documents: Array<{
      title: string;
      category: string;
      similarity: number;
      chunkPreview: string;
    }>;
  };
  ruleMatching?: {
    rulesEvaluated: number;
    matchedRule?: {
      id: string;
      name: string;
      assignee: string;
      matchedConditions: Array<{ field: string; operator: string; value: string }>;
    };
  };
  aiResponse?: {
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs: number;
  };
  errors?: Array<{
    stage: string;
    error: string;
    stack?: string;
  }>;
  performance?: {
    totalDurationMs: number;
    stages: Record<string, number>;
  };
}

/**
 * Start a new chat trace
 */
export const startChatTrace = (employeeEmail?: string): string => {
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const trace: ChatTrace = {
    traceId,
    timestamp: new Date().toISOString(),
    employeeEmail,
    messages: [],
    performance: {
      totalDurationMs: 0,
      stages: {}
    }
  };

  traceStorage.unshift(trace);
  if (traceStorage.length > MAX_TRACES) {
    traceStorage.pop();
  }

  observabilityLogger.info('🔍 New chat trace started', {
    traceId,
    employeeEmail
  });

  return traceId;
};

/**
 * Add employee context to trace
 */
export const logEmployeeContext = (traceId: string, employee: any) => {
  const trace = traceStorage.find(t => t.traceId === traceId);
  if (trace) {
    trace.employeeContext = {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      department: employee.department,
      location: employee.location,
      tags: employee.tags
    };

    observabilityLogger.info('👤 Employee context loaded', {
      traceId,
      employeeId: employee.id,
      department: employee.department,
      location: employee.location,
      tags: employee.tags
    });
  }
};

/**
 * Log conversation messages
 */
export const logMessages = (traceId: string, messages: Array<{ role: string; content: string }>) => {
  const trace = traceStorage.find(t => t.traceId === traceId);
  if (trace) {
    trace.messages = messages;

    observabilityLogger.info('💬 Conversation updated', {
      traceId,
      messageCount: messages.length,
      latestMessage: messages[messages.length - 1]
    });
  }
};

/**
 * Log extracted information
 */
export const logExtractedInfo = (traceId: string, extractedInfo: ExtractedInfo) => {
  const trace = traceStorage.find(t => t.traceId === traceId);
  if (trace) {
    trace.extractedInfo = extractedInfo;

    observabilityLogger.info('📊 Information extracted', {
      traceId,
      extractedInfo
    });
  }
};

/**
 * Log fuzzy matching results
 */
export const logFuzzyMatches = (traceId: string, matches: any) => {
  const trace = traceStorage.find(t => t.traceId === traceId);
  if (trace) {
    trace.fuzzyMatches = matches;

    observabilityLogger.info('🔮 Fuzzy matching applied', {
      traceId,
      matches
    });
  }
};

/**
 * Log RAG document retrieval
 */
export const logRAGContext = (traceId: string, ragData: {
  documentsSearched: number;
  documentsRetrieved: number;
  documents: Array<{
    title: string;
    category: string;
    similarity: number;
    chunkPreview: string;
  }>;
}) => {
  const trace = traceStorage.find(t => t.traceId === traceId);
  if (trace) {
    trace.ragContext = ragData;

    observabilityLogger.info('📚 RAG documents retrieved', {
      traceId,
      documentsSearched: ragData.documentsSearched,
      documentsRetrieved: ragData.documentsRetrieved,
      topDocument: ragData.documents[0]?.title
    });
  }
};

/**
 * Log rule matching
 */
export const logRuleMatching = (traceId: string, ruleData: {
  rulesEvaluated: number;
  matchedRule?: any;
}) => {
  const trace = traceStorage.find(t => t.traceId === traceId);
  if (trace) {
    trace.ruleMatching = ruleData;

    observabilityLogger.info('⚙️ Rule matching executed', {
      traceId,
      rulesEvaluated: ruleData.rulesEvaluated,
      matched: !!ruleData.matchedRule,
      assignee: ruleData.matchedRule?.assignee
    });
  }
};

/**
 * Log AI response
 */
export const logAIResponse = (traceId: string, aiData: {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
}, responseText?: string) => {
  const trace = traceStorage.find(t => t.traceId === traceId);
  if (trace) {
    trace.aiResponse = aiData;

    // Add the assistant's response to the messages array
    if (responseText && trace.messages) {
      trace.messages.push({ role: 'assistant', content: responseText });
    }

    observabilityLogger.info('🤖 AI response generated', {
      traceId,
      model: aiData.model,
      tokens: aiData.totalTokens,
      latencyMs: aiData.latencyMs
    });
  }
};

/**
 * Log error
 */
export const logTraceError = (traceId: string, stage: string, error: Error) => {
  const trace = traceStorage.find(t => t.traceId === traceId);
  if (trace) {
    if (!trace.errors) trace.errors = [];
    trace.errors.push({
      stage,
      error: error.message,
      stack: error.stack
    });

    observabilityLogger.error('❌ Error in chat trace', {
      traceId,
      stage,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Complete trace with total duration
 */
export const completeChatTrace = (traceId: string, startTime: number) => {
  const trace = traceStorage.find(t => t.traceId === traceId);
  if (trace && trace.performance) {
    trace.performance.totalDurationMs = Date.now() - startTime;

    observabilityLogger.info('✅ Chat trace completed', {
      traceId,
      totalDurationMs: trace.performance.totalDurationMs,
      hasErrors: (trace.errors?.length || 0) > 0
    });
  }
};

/**
 * Get recent traces for debugging
 */
export const getRecentTraces = (limit: number = 20): ChatTrace[] => {
  return traceStorage.slice(0, limit);
};

/**
 * Get specific trace by ID
 */
export const getTrace = (traceId: string): ChatTrace | undefined => {
  return traceStorage.find(t => t.traceId === traceId);
};

/**
 * Clear all traces
 */
export const clearTraces = (): void => {
  traceStorage.length = 0;
  observabilityLogger.info('🗑️ All traces cleared');
};
