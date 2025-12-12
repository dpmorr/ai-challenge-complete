import path from 'path';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { processConversation, generateAgentResponse } from './aiAgent';
import { getAllRules, getRule, createRule, updateRule, deleteRule, saveConversation } from './storageDb';
import { enrichWithEmployeeContext } from './employeeContext';
import { TriageRule } from './types';
import logger from './logger';
import {
  requestLogger,
  errorHandler,
  notFoundHandler,
  chatRateLimiter,
  apiRateLimiter,
  validateChatRequest,
  validateRuleRequest
} from './middlewareEnhanced';
import metrics from './metrics';
import { setupSwagger } from './swagger';
import apiRoutes from './routes';
import {
  startChatTrace,
  logEmployeeContext,
  logMessages,
  logExtractedInfo,
  logAIResponse,
  logTraceError,
  completeChatTrace,
  getRecentTraces,
  getTrace
} from './observability';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.OPENAI_API_KEY) {
  logger.warn('OPENAI_API_KEY is not set. Streaming requests will fail.');
}

const app = express();
const port = Number.parseInt(process.env.PORT ?? '5000', 10);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS Configuration - Only allow requests from trusted origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173', // Vite default
  'http://localhost:8999'  // Same origin
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// ============================================================================
// API DOCUMENTATION (Swagger)
// ============================================================================

setupSwagger(app);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ChatCompletionMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type BasicRole = Extract<ChatCompletionMessageParam['role'], 'system' | 'user' | 'assistant'>;
type BasicMessage = { role: BasicRole; content: string };

const allowedRoles: ReadonlySet<BasicRole> = new Set<BasicRole>(['system', 'user', 'assistant']);

const sanitizeMessages = (messages: unknown): BasicMessage[] => {
  if (!Array.isArray(messages)) {
    return [];
  }

  const sanitized: BasicMessage[] = [];

  for (const raw of messages) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }

    const maybeMessage = raw as Record<string, unknown>;
    const role = maybeMessage.role;
    const content = maybeMessage.content;

    if (typeof role !== 'string' || typeof content !== 'string') {
      continue;
    }

    if (!allowedRoles.has(role as BasicRole)) {
      continue;
    }

    // Sanitize content to prevent XSS attacks
    // Strip HTML tags and encode special characters
    const sanitizedContent = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]+>/g, '') // Remove all HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=

    sanitized.push({ role: role as BasicRole, content: sanitizedContent });
  }

  return sanitized;
};

// ============================================================================
// HEALTH CHECK & METRICS
// ============================================================================

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - System
 *     summary: Health check endpoint
 *     description: Returns the health status of the API including metrics and system information
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                 uptime:
 *                   type: number
 *                 features:
 *                   type: object
 *                 metrics:
 *                   type: object
 */
app.get('/health', (_req: Request, res: Response) => {
  const health = metrics.getHealth();

  res.json({
    ...health,
    version: '2.0.0',
    features: {
      chat: true,
      rules: true,
      documentRAG: true,
      employeeContext: true,
      emailWebhooks: true,
      semanticSearch: !!process.env.PINECONE_API_KEY,
      swagger: true,
      metrics: true,
      rateLimiting: true
    }
  });
});

/**
 * @swagger
 * /metrics:
 *   get:
 *     tags:
 *       - System
 *     summary: Get detailed metrics
 *     description: Returns detailed performance and usage metrics
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 */
app.get('/metrics', (_req: Request, res: Response) => {
  const summary = metrics.getSummary();

  res.json({
    success: true,
    ...summary
  });
});

// ============================================================================
// CHAT ENDPOINT
// ============================================================================

/**
 * @swagger
 * /api/chat:
 *   post:
 *     tags:
 *       - Core
 *     summary: Chat with AI triage agent
 *     description: Send messages to the AI triage agent and receive routing recommendations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Message'
 *               employeeEmail:
 *                 type: string
 *                 format: email
 *                 description: Optional employee email for context auto-fill
 *             example:
 *               messages:
 *                 - role: user
 *                   content: I need help with a sales contract in Australia
 *               employeeEmail: alice.smith@acme.corp
 *     responses:
 *       200:
 *         description: AI response (streaming text)
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Server error
 */
app.post('/api/chat', chatRateLimiter, validateChatRequest, async (req: Request, res: Response) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: {
        message: 'Server missing OpenAI credentials',
        type: 'ConfigurationError'
      }
    });
  }

  const basicMessages = sanitizeMessages(req.body?.messages);
  const employeeEmail = req.body?.employeeEmail;

  if (basicMessages.length === 0) {
    return res.status(400).json({
      error: {
        message: 'messages array is empty or invalid',
        type: 'ValidationError'
      }
    });
  }

  const startTime = Date.now();

  // Start observability trace
  const traceId = startChatTrace(employeeEmail);
  logMessages(traceId, basicMessages);

  try {
    // Get employee context FIRST if email provided (needed for dynamic routing)
    let employeeData = null;
    if (employeeEmail) {
      const enrichedInfo = await enrichWithEmployeeContext({}, employeeEmail);
      employeeData = enrichedInfo._employeeData;

      // Log employee context if we successfully enriched
      if (employeeData) {
        logEmployeeContext(traceId, employeeData);
      }
    }

    // Process the conversation to determine triage state (with employee context for dynamic routing)
    const triageState = await processConversation(basicMessages, traceId, employeeData);

    // Enrich extracted info with employee context
    let enrichedInfo = triageState.extractedInfo;
    if (employeeEmail) {
      enrichedInfo = await enrichWithEmployeeContext(triageState.extractedInfo, employeeEmail);
      triageState.extractedInfo = enrichedInfo;
    }

    // Log extracted information
    logExtractedInfo(traceId, enrichedInfo);

    // Generate the agent's response
    const aiStartTime = Date.now();
    const responseText = await generateAgentResponse(basicMessages, triageState, traceId);
    const aiLatency = Date.now() - aiStartTime;

    // Log AI response (including the response text to add to trace messages)
    logAIResponse(traceId, {
      model: process.env.OPENAI_BASE_URL?.includes('groq') ? 'openai/gpt-oss-120b' : 'gpt-4o-mini',
      latencyMs: aiLatency
    }, responseText);

    const duration = Date.now() - startTime;

    // Complete the trace
    completeChatTrace(traceId, startTime);

    // Track chat metrics
    metrics.trackChat({
      messageCount: basicMessages.length,
      assigned: triageState.isComplete,
      assignee: triageState.assignedTo,
      duration
    });

    // Save conversation to history
    try {
      await saveConversation(
        enrichedInfo._employeeId || null,
        [...basicMessages, { role: 'assistant', content: responseText }],
        triageState.assignedTo || null,
        enrichedInfo
      );
    } catch (error) {
      logger.warn('Failed to save conversation history', { error });
    }

    // Stream the response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Processing-Time', `${duration}ms`);
    res.setHeader('X-Assigned', triageState.isComplete ? 'true' : 'false');
    res.setHeader('X-Trace-Id', traceId);
    if (triageState.assignedTo) {
      res.setHeader('X-Assignee', triageState.assignedTo);
    }

    (res as Response & { flushHeaders?: () => void }).flushHeaders?.();

    // Simulate streaming by sending chunks
    const words = responseText.split(' ');
    for (let i = 0; i < words.length; i++) {
      res.write(words[i] + (i < words.length - 1 ? ' ' : ''));
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    res.end();
  } catch (error) {
    logger.error({ error, messageCount: basicMessages.length }, 'Chat error');

    // Log error to trace
    logTraceError(traceId, 'chat_endpoint', error as Error);
    completeChatTrace(traceId, startTime);

    if (!res.headersSent) {
      return res.status(500).json({
        error: {
          message: 'Failed to process chat',
          type: 'ProcessingError'
        }
      });
    }

    res.write('\n[Error processing request]\n');
    res.end();
  }
});

// ============================================================================
// TRIAGE RULES MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/rules:
 *   get:
 *     tags:
 *       - Rules
 *     summary: List all triage rules
 *     responses:
 *       200:
 *         description: Rules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 rules:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TriageRule'
 *                 count:
 *                   type: integer
 */
app.get('/api/rules', apiRateLimiter, async (_req: Request, res: Response) => {
  try {
    const rules = await getAllRules();
    res.json({
      success: true,
      rules,
      count: rules.length
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching rules');
    res.status(500).json({
      error: {
        message: 'Failed to fetch rules',
        type: 'DatabaseError'
      }
    });
  }
});

/**
 * @swagger
 * /api/rules/{id}:
 *   get:
 *     tags:
 *       - Rules
 *     summary: Get a specific rule by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rule ID
 *     responses:
 *       200:
 *         description: Rule found
 *       404:
 *         description: Rule not found
 */
app.get('/api/rules/:id', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const rule = await getRule(req.params.id);
    if (!rule) {
      return res.status(404).json({
        error: {
          message: 'Rule not found',
          type: 'NotFound'
        }
      });
    }
    res.json({
      success: true,
      rule
    });
  } catch (error) {
    logger.error({ error, ruleId: req.params.id }, 'Error fetching rule');
    res.status(500).json({
      error: {
        message: 'Failed to fetch rule',
        type: 'DatabaseError'
      }
    });
  }
});

/**
 * @swagger
 * /api/rules:
 *   post:
 *     tags:
 *       - Rules
 *     summary: Create a new triage rule
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - conditions
 *               - assignee
 *               - priority
 *             properties:
 *               name:
 *                 type: string
 *               conditions:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Condition'
 *               assignee:
 *                 type: string
 *                 format: email
 *               priority:
 *                 type: integer
 *               enabled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Rule created successfully
 *       400:
 *         description: Validation error
 */
app.post('/api/rules', apiRateLimiter, validateRuleRequest, async (req: Request, res: Response) => {
  try {
    const { name, conditions, assignee, priority, enabled } = req.body;

    const newRule = await createRule({
      name,
      conditions,
      assignee,
      priority,
      enabled: enabled ?? true
    });

    logger.info({ ruleId: newRule.id, name }, 'Rule created');

    res.status(201).json({
      success: true,
      rule: newRule
    });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Error creating rule');
    res.status(500).json({
      error: {
        message: 'Failed to create rule',
        type: 'DatabaseError'
      }
    });
  }
});

app.put('/api/rules/:id', apiRateLimiter, validateRuleRequest, async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const updatedRule = await updateRule(req.params.id, updates);

    if (!updatedRule) {
      return res.status(404).json({
        error: {
          message: 'Rule not found',
          type: 'NotFound'
        }
      });
    }

    logger.info({ ruleId: req.params.id }, 'Rule updated');

    res.json({
      success: true,
      rule: updatedRule
    });
  } catch (error) {
    logger.error({ error, ruleId: req.params.id }, 'Error updating rule');
    res.status(500).json({
      error: {
        message: 'Failed to update rule',
        type: 'DatabaseError'
      }
    });
  }
});

app.delete('/api/rules/:id', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const deleted = await deleteRule(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        error: {
          message: 'Rule not found',
          type: 'NotFound'
        }
      });
    }

    logger.info({ ruleId: req.params.id }, 'Rule deleted');

    res.status(204).send();
  } catch (error) {
    logger.error({ error, ruleId: req.params.id }, 'Error deleting rule');
    res.status(500).json({
      error: {
        message: 'Failed to delete rule',
        type: 'DatabaseError'
      }
    });
  }
});

// ============================================================================
// MOUNT API ROUTES (Documents, Employees, Email Webhooks, etc.)
// ============================================================================

console.log('🔌 Mounting apiRoutes at /api...');
console.log('📦 apiRoutes type:', typeof apiRoutes);
console.log('📦 Route paths:', (apiRoutes as any).stack?.map((layer: any) => ({
  path: layer.route?.path,
  methods: layer.route?.methods
})));
// Test: add a direct route to verify this works
app.get('/api/test-direct', (_req: Request, res: Response) => {
  console.log('✅ Direct test route called!');
  res.json({ message: 'Direct route works!' });
});

// Temporarily remove rate limiter to debug
// Add debug middleware to see if requests reach the router
app.use('/api', (req: Request, _res: Response, next: Function) => {
  console.log(`🔍 Request to /api${req.path} - Method: ${req.method}`);
  next();
});
app.use('/api', apiRoutes);
console.log('✅ apiRoutes mounted successfully (without rate limiter)');

// ============================================================================
// ERROR HANDLERS
// ============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// START SERVER
// ============================================================================

app.listen(port, () => {
  logger.info({
    port,
    nodeEnv: process.env.NODE_ENV,
    features: {
      pinecone: !!process.env.PINECONE_API_KEY,
      embeddings: !!process.env.OPENAI_API_KEY,
      swagger: true,
      metrics: true,
      rateLimiting: true
    }
  }, `🚀 Server listening on port ${port}`);

  logger.info('📚 Swagger UI available at http://localhost:' + port + '/api-docs');
  logger.info('📊 Metrics available at http://localhost:' + port + '/metrics');
  logger.info('💚 Health check available at http://localhost:' + port + '/health');
  logger.info('');
  logger.info('Available endpoints:');
  logger.info('  POST /api/chat - Chat triage');
  logger.info('  GET  /api/rules - List rules');
  logger.info('  GET  /api/documents - List documents');
  logger.info('  POST /api/documents/search - Semantic search');
  logger.info('  POST /api/documents/ask - RAG Q&A');
  logger.info('  GET  /api/employees - List employees');
  logger.info('  POST /api/webhooks/email - Email webhook');
  logger.info('  GET  /api/system/info - System info');
});

