import { Router, Request, Response } from 'express';
import {
  addDocument,
  deleteDocument,
  getAllDocuments,
  getDocument,
  updateDocument,
  searchDocuments,
  generateRAGResponse
} from './documentRAG';
import {
  processIncomingEmail,
  getRoutingStats,
  getEmailRouteHistory,
  retryEmailRoute,
  parseSendGridWebhook,
  parseMailgunWebhook,
  parseGenericWebhook
} from './emailWebhook';
import {
  getEmployeeProfile,
  getAllEmployees,
  upsertEmployeeProfile,
  getEmployeeConversationHistory,
  getEmployeeRequestPatterns,
  bulkImportEmployees,
  attachDocumentToEmployee,
  detachDocumentFromEmployee,
  getEmployeeDocuments
} from './employeeContext';
import { getAllLawyers, getLawyerByEmail } from './storageDb';
import { isPineconeConfigured } from './embeddings';
import prisma from './db';
import { getRecentTraces, getTrace, clearTraces } from './observability';

console.log('🔧 Loading routes.ts...');

const router = Router();

console.log('✅ Router created successfully');

// ============================================================================
// DOCUMENT RAG ENDPOINTS
// ============================================================================

/**
 * GET /api/documents
 * Get all documents (optionally filtered by category)
 */
console.log('📝 Registering GET /api/documents route');
router.get('/documents', async (req: Request, res: Response) => {
  console.log('✅ GET /api/documents called');
  try {
    const { category } = req.query;
    const documents = await getAllDocuments(category as string);

    res.json({
      success: true,
      documents,
      count: documents.length
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents'
    });
  }
});

/**
 * GET /api/documents/:id
 * Get a specific document by ID
 */
router.get('/documents/:id', async (req: Request, res: Response) => {
  try {
    const document = await getDocument(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document'
    });
  }
});

/**
 * POST /api/documents
 * Add a new document with automatic chunking and embedding
 */
router.post('/documents', async (req: Request, res: Response) => {
  try {
    const { title, content, category, tags, metadata } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, content, category'
      });
    }

    const documentId = await addDocument({
      title,
      content,
      category,
      tags: tags || [],
      metadata: metadata || {}
    });

    res.status(201).json({
      success: true,
      documentId,
      message: `Document "${title}" created successfully`
    });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create document'
    });
  }
});

/**
 * PUT /api/documents/:id
 * Update a document (regenerates embeddings if content changed)
 */
router.put('/documents/:id', async (req: Request, res: Response) => {
  try {
    await updateDocument(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Document updated successfully'
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update document'
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and its embeddings
 */
router.delete('/documents/:id', async (req: Request, res: Response) => {
  try {
    await deleteDocument(req.params.id);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});

/**
 * POST /api/documents/search
 * Semantic search over documents
 */
router.post('/documents/search', async (req: Request, res: Response) => {
  try {
    const { query, category, topK } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const results = await searchDocuments(query, category, topK || 5);

    res.json({
      success: true,
      results,
      count: results.length,
      usingSemanticSearch: isPineconeConfigured()
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search documents'
    });
  }
});

/**
 * POST /api/documents/ask
 * Ask a question and get an AI-generated response using RAG
 */
router.post('/documents/ask', async (req: Request, res: Response) => {
  try {
    const { query, category, conversationHistory } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const response = await generateRAGResponse(query, category, conversationHistory, undefined);

    res.json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error generating RAG response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate response'
    });
  }
});

// ============================================================================
// EMAIL WEBHOOK ENDPOINTS
// ============================================================================

/**
 * POST /api/webhooks/email
 * Generic email webhook handler
 */
router.post('/webhooks/email', async (req: Request, res: Response) => {
  try {
    const email = parseGenericWebhook(req.body);
    const result = await processIncomingEmail(email);

    res.json(result);
  } catch (error) {
    console.error('Error processing email webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process email'
    });
  }
});

/**
 * POST /api/webhooks/sendgrid
 * SendGrid-specific webhook handler
 */
router.post('/webhooks/sendgrid', async (req: Request, res: Response) => {
  try {
    const email = parseSendGridWebhook(req.body);
    const result = await processIncomingEmail(email);

    res.json(result);
  } catch (error) {
    console.error('Error processing SendGrid webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process email'
    });
  }
});

/**
 * POST /api/webhooks/mailgun
 * Mailgun-specific webhook handler
 */
router.post('/webhooks/mailgun', async (req: Request, res: Response) => {
  try {
    const email = parseMailgunWebhook(req.body);
    const result = await processIncomingEmail(email);

    res.json(result);
  } catch (error) {
    console.error('Error processing Mailgun webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process email'
    });
  }
});

/**
 * GET /api/email-routes
 * Get email routing history
 */
router.get('/email-routes', async (req: Request, res: Response) => {
  try {
    const { fromEmail, status, limit } = req.query;

    const routes = await getEmailRouteHistory(
      fromEmail as string,
      status as string,
      limit ? parseInt(limit as string) : 50
    );

    res.json({
      success: true,
      routes,
      count: routes.length
    });
  } catch (error) {
    console.error('Error fetching email routes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email routes'
    });
  }
});

/**
 * GET /api/email-routes/stats
 * Get routing statistics
 */
router.get('/email-routes/stats', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const stats = await getRoutingStats(days ? parseInt(days as string) : 7);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching routing stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch routing stats'
    });
  }
});

/**
 * POST /api/email-routes/:id/retry
 * Retry a failed email route
 */
router.post('/email-routes/:id/retry', async (req: Request, res: Response) => {
  try {
    const result = await retryEmailRoute(req.params.id);

    res.json(result);
  } catch (error) {
    console.error('Error retrying email route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry email route'
    });
  }
});

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/login
 * Simple email-based login (checks if employee exists and creates/updates user)
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Find employee by email
    const employee = await getEmployeeProfile(email);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found. Please contact your administrator.'
      });
    }

    // Create or update user record
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        lastLoginAt: new Date(),
        employeeId: employee.id
      },
      create: {
        email,
        employeeId: employee.id,
        lastLoginAt: new Date()
      },
      include: {
        employee: true
      }
    });

    console.log(`✅ User logged in: ${email}`);

    // Return employee data (in production, you'd generate a proper JWT token)
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        lastLoginAt: user.lastLoginAt
      },
      employee,
      token: `token_${user.id}` // Simple token for demo purposes
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout endpoint (placeholder for session cleanup if needed)
 */
router.post('/auth/logout', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// ============================================================================
// EMPLOYEE CONTEXT ENDPOINTS
// ============================================================================

/**
 * GET /api/employees
 * Get all employees
 */
router.get('/employees', async (req: Request, res: Response) => {
  try {
    const employees = await getAllEmployees();

    res.json({
      success: true,
      employees,
      count: employees.length
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees'
    });
  }
});

/**
 * GET /api/employees/:email
 * Get employee profile by email
 */
router.get('/employees/:email', async (req: Request, res: Response) => {
  try {
    const employee = await getEmployeeProfile(req.params.email);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    res.json({
      success: true,
      employee
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee'
    });
  }
});

/**
 * POST /api/employees
 * Create or update employee profile
 */
router.post('/employees', async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, department, location, role } = req.body;

    if (!email || !firstName || !lastName || !department || !location || !role) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const employee = await upsertEmployeeProfile(email, {
      firstName,
      lastName,
      department,
      location,
      role
    });

    res.json({
      success: true,
      employee
    });
  } catch (error) {
    console.error('Error creating/updating employee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create/update employee'
    });
  }
});

/**
 * POST /api/employees/bulk-import
 * Bulk import employees
 */
router.post('/employees/bulk-import', async (req: Request, res: Response) => {
  try {
    const { employees } = req.body;

    if (!Array.isArray(employees)) {
      return res.status(400).json({
        success: false,
        error: 'employees must be an array'
      });
    }

    const imported = await bulkImportEmployees(employees);

    res.json({
      success: true,
      imported,
      total: employees.length
    });
  } catch (error) {
    console.error('Error bulk importing employees:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import employees'
    });
  }
});

/**
 * GET /api/employees/:email/history
 * Get conversation history for an employee
 */
router.get('/employees/:email/history', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const history = await getEmployeeConversationHistory(
      req.params.email,
      limit ? parseInt(limit as string) : 10
    );

    res.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('Error fetching employee history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee history'
    });
  }
});

/**
 * GET /api/employees/:email/patterns
 * Get request patterns for an employee
 */
router.get('/employees/:email/patterns', async (req: Request, res: Response) => {
  try {
    const patterns = await getEmployeeRequestPatterns(req.params.email);

    res.json({
      success: true,
      patterns
    });
  } catch (error) {
    console.error('Error fetching employee patterns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee patterns'
    });
  }
});

/**
 * GET /api/employees/:id/documents
 * Get all documents attached to an employee
 */
router.get('/employees/:id/documents', async (req: Request, res: Response) => {
  try {
    const documents = await getEmployeeDocuments(req.params.id);

    res.json({
      success: true,
      documents,
      count: documents.length
    });
  } catch (error) {
    console.error('Error fetching employee documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee documents'
    });
  }
});

/**
 * POST /api/employees/:id/documents
 * Attach a document to an employee
 */
router.post('/employees/:id/documents', async (req: Request, res: Response) => {
  try {
    const { documentId, notes } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'documentId is required'
      });
    }

    await attachDocumentToEmployee(req.params.id, documentId, notes);

    res.json({
      success: true,
      message: 'Document attached successfully'
    });
  } catch (error) {
    console.error('Error attaching document to employee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to attach document'
    });
  }
});

/**
 * DELETE /api/employees/:id/documents/:documentId
 * Detach a document from an employee
 */
router.delete('/employees/:id/documents/:documentId', async (req: Request, res: Response) => {
  try {
    await detachDocumentFromEmployee(req.params.id, req.params.documentId);

    res.json({
      success: true,
      message: 'Document detached successfully'
    });
  } catch (error) {
    console.error('Error detaching document from employee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detach document'
    });
  }
});

// ============================================================================
// CALENDAR INTEGRATION ENDPOINTS
// ============================================================================

/**
 * POST /api/employees/:id/sync-calendar
 * Sync employee calendar availability (mock Calendly integration)
 */
router.post('/employees/:id/sync-calendar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Mock calendar availability data (simulates Calendly API response)
    const mockCalendarData = {
      timezone: 'America/New_York',
      workingHours: {
        monday: { start: '09:00', end: '17:00', available: true },
        tuesday: { start: '09:00', end: '17:00', available: true },
        wednesday: { start: '09:00', end: '17:00', available: true },
        thursday: { start: '09:00', end: '17:00', available: true },
        friday: { start: '09:00', end: '17:00', available: true },
        saturday: { available: false },
        sunday: { available: false }
      },
      upcomingAvailability: [
        { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], slots: ['10:00', '14:00', '15:30'] },
        { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], slots: ['09:00', '11:00', '16:00'] },
        { date: new Date(Date.now() + 259200000).toISOString().split('T')[0], slots: ['10:30', '13:00', '15:00'] }
      ],
      lastSynced: new Date().toISOString(),
      source: 'calendly'
    };

    // Update employee with synced calendar data
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        calendarAvailability: mockCalendarData
      }
    });

    console.log(`✅ Synced calendar for employee ${id}`);

    res.json({
      success: true,
      message: 'Calendar synced successfully',
      availability: mockCalendarData,
      employee
    });
  } catch (error) {
    console.error('Error syncing calendar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync calendar'
    });
  }
});

/**
 * POST /api/webhooks/calendly
 * Webhook endpoint for Calendly calendar updates
 */
router.post('/webhooks/calendly', async (req: Request, res: Response) => {
  try {
    const { event, payload } = req.body;

    console.log('📅 Received Calendly webhook:', event);

    // Calendly webhook events: invitee.created, invitee.canceled, etc.
    if (event === 'invitee.created' || event === 'invitee.canceled') {
      const { email, event_start_time, event_end_time, cancel_url, reschedule_url } = payload;

      // Find employee by email
      const employee = await prisma.employee.findUnique({
        where: { email }
      });

      if (employee) {
        // Update employee's calendar availability
        const currentAvailability = employee.calendarAvailability as any || {};
        const updatedAvailability = {
          ...currentAvailability,
          lastWebhookEvent: {
            type: event,
            eventStart: event_start_time,
            eventEnd: event_end_time,
            receivedAt: new Date().toISOString()
          }
        };

        await prisma.employee.update({
          where: { id: employee.id },
          data: {
            calendarAvailability: updatedAvailability
          }
        });

        console.log(`✅ Updated calendar for ${email} via webhook`);
      }
    }

    res.json({
      success: true,
      message: 'Webhook processed'
    });
  } catch (error) {
    console.error('Error processing Calendly webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    });
  }
});

/**
 * POST /api/webhooks/calendly/test
 * Test endpoint to simulate Calendly webhook (for development)
 */
router.post('/webhooks/calendly/test', async (req: Request, res: Response) => {
  try {
    const { employeeEmail } = req.body;

    if (!employeeEmail) {
      return res.status(400).json({
        success: false,
        error: 'employeeEmail is required'
      });
    }

    // Simulate Calendly webhook payload
    const testWebhook = {
      event: 'invitee.created',
      payload: {
        email: employeeEmail,
        name: 'Test User',
        event_start_time: new Date(Date.now() + 86400000).toISOString(),
        event_end_time: new Date(Date.now() + 90000000).toISOString(),
        cancel_url: 'https://calendly.com/cancellations/test',
        reschedule_url: 'https://calendly.com/reschedulings/test'
      }
    };

    // Send to our webhook endpoint
    const webhookUrl = `${req.protocol}://${req.get('host')}/api/webhooks/calendly`;

    console.log(`📤 Sending test webhook to ${webhookUrl}`);

    res.json({
      success: true,
      message: 'Test webhook payload generated',
      webhook: testWebhook,
      instructions: `Send this payload to POST ${webhookUrl}`
    });
  } catch (error) {
    console.error('Error creating test webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test webhook'
    });
  }
});

// ============================================================================
// LAWYER ENDPOINTS
// ============================================================================

/**
 * GET /api/lawyers
 * Get all lawyers with their specialties
 */
router.get('/lawyers', async (req: Request, res: Response) => {
  try {
    const lawyers = await getAllLawyers();

    res.json({
      success: true,
      lawyers,
      count: lawyers.length
    });
  } catch (error) {
    console.error('Error fetching lawyers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lawyers'
    });
  }
});

/**
 * GET /api/lawyers/:email
 * Get lawyer profile by email
 */
router.get('/lawyers/:email', async (req: Request, res: Response) => {
  try {
    const lawyer = await getLawyerByEmail(req.params.email);

    if (!lawyer) {
      return res.status(404).json({
        success: false,
        error: 'Lawyer not found'
      });
    }

    res.json({
      success: true,
      lawyer
    });
  } catch (error) {
    console.error('Error fetching lawyer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lawyer'
    });
  }
});

// ============================================================================
// SYSTEM INFO ENDPOINTS
// ============================================================================

/**
 * GET /api/system/info
 * Get system configuration and feature availability
 */
router.get('/system/info', async (req: Request, res: Response) => {
  res.json({
    success: true,
    features: {
      semanticSearch: isPineconeConfigured(),
      documentRAG: true,
      employeeContext: true,
      emailWebhooks: true,
      fuzzyMatching: true
    },
    configuration: {
      pineconeConfigured: isPineconeConfigured(),
      embeddingModel: 'text-embedding-3-small',
      llmModel: process.env.OPENAI_BASE_URL?.includes('groq') ? 'openai/gpt-oss-120b' : 'gpt-4o-mini'
    }
  });
});

// ============================================================================
// OBSERVABILITY / TRACE ENDPOINTS
// ============================================================================

/**
 * GET /api/traces
 * Get recent chat traces for debugging
 */
router.get('/traces', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const traces = getRecentTraces(limit ? parseInt(limit as string) : 20);

    res.json({
      success: true,
      traces,
      count: traces.length
    });
  } catch (error) {
    console.error('Error fetching traces:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch traces'
    });
  }
});

/**
 * GET /api/traces/:traceId
 * Get a specific trace by ID
 */
router.get('/traces/:traceId', async (req: Request, res: Response) => {
  try {
    const trace = getTrace(req.params.traceId);

    if (!trace) {
      return res.status(404).json({
        success: false,
        error: 'Trace not found'
      });
    }

    res.json({
      success: true,
      trace
    });
  } catch (error) {
    console.error('Error fetching trace:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trace'
    });
  }
});

/**
 * DELETE /api/traces
 * Clear all traces (for debugging/development)
 */
router.delete('/traces', async (req: Request, res: Response) => {
  try {
    clearTraces();

    res.json({
      success: true,
      message: 'All traces cleared'
    });
  } catch (error) {
    console.error('Error clearing traces:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear traces'
    });
  }
});

export default router;
