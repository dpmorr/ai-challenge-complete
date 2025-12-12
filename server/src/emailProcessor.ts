import { processConversation, generateAgentResponse } from './aiAgent';
import { getEmployeeProfile } from './employeeContext';
import prisma from './db';
import { startChatTrace, logMessages, logEmployeeContext, logExtractedInfo, logAIResponse, completeChatTrace } from './observability';

export interface IncomingEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  timestamp: Date;
  messageId?: string;
}

export interface EmailResponse {
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  html?: string;
  replyTo?: string;
}

/**
 * Process an incoming email through the triage system
 * This is the main entry point for email automation
 */
export const processIncomingEmail = async (
  email: IncomingEmail
): Promise<EmailResponse | null> => {
  const startTime = Date.now();
  const traceId = startChatTrace(email.from);

  try {
    console.log(`📧 Processing email from ${email.from}: "${email.subject}"`);

    // 1. Look up employee by email
    const employee = await getEmployeeProfile(email.from);

    if (!employee) {
      console.log(`⚠️  Email from unknown sender: ${email.from}`);
      // Log to database for review
      await logUnknownEmail(email);
      return createUnknownSenderResponse(email);
    }

    logEmployeeContext(traceId, {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      department: employee.department,
      location: employee.location,
      tags: employee.tags
    });

    // 2. Convert email to chat message format
    const userMessage = formatEmailAsMessage(email);
    const messages = [{ role: 'user' as const, content: userMessage }];

    logMessages(traceId, messages);

    // 3. Process through triage system
    const triageState = await processConversation(messages, traceId, employee);

    // Enrich with employee context
    const enrichedInfo = {
      ...triageState.extractedInfo,
      _employeeId: employee.id,
      _employeeName: `${employee.firstName} ${employee.lastName}`,
      _employeeRole: employee.role
    };

    logExtractedInfo(traceId, enrichedInfo);

    // 4. Generate response
    const aiStartTime = Date.now();
    const responseText = await generateAgentResponse(messages, triageState, traceId);
    const aiLatency = Date.now() - aiStartTime;

    logAIResponse(traceId, {
      model: process.env.OPENAI_BASE_URL?.includes('groq') ? 'openai/gpt-oss-120b' : 'gpt-4o-mini',
      latencyMs: aiLatency
    });

    // 5. Save conversation to database
    await saveEmailConversation(email, employee.id, triageState.assignedTo, enrichedInfo);

    // 6. Log email route for tracking
    await logEmailRoute(email, triageState.assignedTo, triageState, 'routed');

    // 7. Create email response
    const emailResponse = createEmailResponse(email, employee, triageState, responseText);

    completeChatTrace(traceId, startTime);

    console.log(`✅ Email processed successfully. Routed to: ${triageState.assignedTo || 'pending'}`);

    return emailResponse;

  } catch (error) {
    console.error('❌ Error processing email:', error);

    // Log failed route
    await logEmailRoute(email, null, null, 'failed', (error as Error).message);

    completeChatTrace(traceId, startTime);

    return createErrorResponse(email);
  }
};

/**
 * Format email content as a chat message
 */
const formatEmailAsMessage = (email: IncomingEmail): string => {
  // Extract plain text from body (strip HTML if needed)
  let content = email.body;

  // If body is HTML, try to extract text (simple approach)
  if (email.html && !content) {
    content = email.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Include subject if it contains useful context
  if (email.subject && !email.subject.toLowerCase().startsWith('re:')) {
    return `Subject: ${email.subject}\n\n${content}`;
  }

  return content;
};

/**
 * Create email response based on triage result
 */
const createEmailResponse = (
  originalEmail: IncomingEmail,
  employee: any,
  triageState: any,
  aiResponse: string
): EmailResponse => {
  const isComplete = triageState.isComplete && triageState.assignedTo;

  if (isComplete) {
    // Request was successfully routed
    return {
      to: employee.email,
      cc: [triageState.assignedTo], // CC the assigned lawyer
      subject: `Re: ${originalEmail.subject}`,
      body: `Hi ${employee.firstName},\n\n${aiResponse}\n\nI've also CC'd ${triageState.assignedTo} who will assist you with this request.\n\nBest regards,\nLegal Triage System`,
      html: formatEmailAsHtml(employee.firstName, aiResponse, triageState.assignedTo),
      replyTo: triageState.assignedTo
    };
  } else {
    // Need more information
    return {
      to: employee.email,
      subject: `Re: ${originalEmail.subject}`,
      body: `Hi ${employee.firstName},\n\n${aiResponse}\n\nPlease reply to this email with the requested information and I'll route your request to the appropriate legal team member.\n\nBest regards,\nLegal Triage System`,
      html: formatEmailAsHtml(employee.firstName, aiResponse)
    };
  }
};

/**
 * Format email response as HTML
 */
const formatEmailAsHtml = (firstName: string, message: string, ccEmail?: string): string => {
  const ccSection = ccEmail
    ? `<p><em>I've also CC'd ${ccEmail} who will assist you with this request.</em></p>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .message { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { font-size: 12px; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <p>Hi ${firstName},</p>
        <div class="message">
          ${message.split('\n').map(line => `<p>${line}</p>`).join('')}
        </div>
        ${ccSection}
        <p>Best regards,<br>Legal Triage System</p>
        <div class="footer">
          <p>This is an automated response from the Acme Corp Legal Triage System. If you need immediate assistance, please contact legal@acme.corp directly.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Create response for unknown sender
 */
const createUnknownSenderResponse = (email: IncomingEmail): EmailResponse => {
  return {
    to: email.from,
    subject: `Re: ${email.subject}`,
    body: `Hello,\n\nThank you for contacting Acme Corp Legal. However, we couldn't find your email (${email.from}) in our employee directory.\n\nIf you're an Acme Corp employee, please contact HR to update your profile. If you're an external party, please contact us at legal@acme.corp directly.\n\nBest regards,\nLegal Team`,
    html: `
      <p>Hello,</p>
      <p>Thank you for contacting Acme Corp Legal. However, we couldn't find your email (<strong>${email.from}</strong>) in our employee directory.</p>
      <p>If you're an Acme Corp employee, please contact HR to update your profile. If you're an external party, please contact us at <a href="mailto:legal@acme.corp">legal@acme.corp</a> directly.</p>
      <p>Best regards,<br>Legal Team</p>
    `
  };
};

/**
 * Create error response
 */
const createErrorResponse = (email: IncomingEmail): EmailResponse => {
  return {
    to: email.from,
    subject: `Re: ${email.subject}`,
    body: `Hello,\n\nWe encountered an error processing your legal request. Our team has been notified and will follow up with you shortly.\n\nFor urgent matters, please contact legal@acme.corp directly.\n\nBest regards,\nLegal Team`,
    html: `
      <p>Hello,</p>
      <p>We encountered an error processing your legal request. Our team has been notified and will follow up with you shortly.</p>
      <p>For urgent matters, please contact <a href="mailto:legal@acme.corp">legal@acme.corp</a> directly.</p>
      <p>Best regards,<br>Legal Team</p>
    `
  };
};

/**
 * Save email conversation to database
 */
const saveEmailConversation = async (
  email: IncomingEmail,
  employeeId: string,
  assignedTo: string | undefined,
  extractedInfo: any
): Promise<void> => {
  await prisma.conversation.create({
    data: {
      employeeId,
      assignedTo,
      extractedInfo,
      resolved: !!assignedTo,
      messages: {
        create: [
          {
            role: 'user',
            content: formatEmailAsMessage(email)
          }
        ]
      }
    }
  });
};

/**
 * Log email route for tracking and analytics
 */
const logEmailRoute = async (
  email: IncomingEmail,
  routedTo: string | null,
  triageState: any,
  status: 'pending' | 'routed' | 'failed',
  errorMessage?: string
): Promise<void> => {
  await prisma.emailRoute.create({
    data: {
      fromEmail: email.from,
      subject: email.subject,
      body: email.body,
      routedTo,
      ruleMatched: triageState?.matchReason || null,
      confidence: triageState?.matchScore ? triageState.matchScore / 100 : null,
      status,
      errorMessage,
      metadata: {
        messageId: email.messageId,
        timestamp: email.timestamp,
        extractedInfo: triageState?.extractedInfo
      },
      processedAt: status === 'routed' ? new Date() : null
    }
  });
};

/**
 * Log unknown email for review
 */
const logUnknownEmail = async (email: IncomingEmail): Promise<void> => {
  await logEmailRoute(email, null, null, 'failed', 'Unknown sender - not in employee directory');
};

/**
 * Batch process multiple emails (useful for processing backlog)
 */
export const batchProcessEmails = async (
  emails: IncomingEmail[]
): Promise<{ processed: number; failed: number; responses: EmailResponse[] }> => {
  const responses: EmailResponse[] = [];
  let processed = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      const response = await processIncomingEmail(email);
      if (response) {
        responses.push(response);
        processed++;
      }
    } catch (error) {
      console.error(`Failed to process email from ${email.from}:`, error);
      failed++;
    }
  }

  console.log(`📊 Batch processing complete: ${processed} processed, ${failed} failed`);

  return { processed, failed, responses };
};
