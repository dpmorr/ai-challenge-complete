import prisma from './db';
import { processConversation } from './aiAgent';
import { enrichWithEmployeeContext } from './employeeContext';
import { getLawyerByEmail } from './storageDb';

export interface IncomingEmail {
  from: string;
  subject: string;
  body: string;
  metadata?: Record<string, any>;
}

export interface EmailRouteResult {
  success: boolean;
  routedTo?: string;
  confidence?: number;
  error?: string;
  routeId: string;
}

/**
 * Process an incoming email and route it to the appropriate lawyer
 * This is the main webhook handler for email integrations (SendGrid, Mailgun, etc.)
 */
export const processIncomingEmail = async (email: IncomingEmail): Promise<EmailRouteResult> => {
  // Create email route record
  const route = await prisma.emailRoute.create({
    data: {
      fromEmail: email.from,
      subject: email.subject,
      body: email.body,
      status: 'pending',
      metadata: email.metadata || {}
    }
  });

  try {
    // Convert email to conversation format
    const messages = [
      {
        role: 'user' as const,
        content: `Subject: ${email.subject}\n\n${email.body}`
      }
    ];

    // Process conversation through AI triage
    const triageState = await processConversation(messages);

    // Enrich with employee context if sender is a known employee
    const enrichedInfo = await enrichWithEmployeeContext(
      triageState.extractedInfo,
      email.from
    );

    if (triageState.isComplete && triageState.assignedTo) {
      // Successfully routed
      await prisma.emailRoute.update({
        where: { id: route.id },
        data: {
          routedTo: triageState.assignedTo,
          ruleMatched: triageState.assignedTo, // Could store rule ID here
          confidence: 1.0,
          status: 'routed',
          processedAt: new Date()
        }
      });

      // Log to conversation history
      await prisma.conversation.create({
        data: {
          employeeId: enrichedInfo._employeeId,
          assignedTo: triageState.assignedTo,
          resolved: false,
          extractedInfo: enrichedInfo,
          messages: {
            create: [
              {
                role: 'user',
                content: messages[0].content
              },
              {
                role: 'system',
                content: `Auto-routed to ${triageState.assignedTo} via email webhook`
              }
            ]
          }
        }
      });

      console.log(`📧 Email routed: ${email.from} → ${triageState.assignedTo}`);

      return {
        success: true,
        routedTo: triageState.assignedTo,
        confidence: 1.0,
        routeId: route.id
      };
    } else {
      // Could not route - needs more information
      const missingFields = triageState.missingFields.join(', ');

      await prisma.emailRoute.update({
        where: { id: route.id },
        data: {
          status: 'failed',
          errorMessage: `Unable to route automatically. Missing information: ${missingFields}`,
          processedAt: new Date()
        }
      });

      console.log(`⚠️  Email could not be routed: ${email.from} - missing ${missingFields}`);

      return {
        success: false,
        error: `Unable to route automatically. Missing: ${missingFields}`,
        routeId: route.id
      };
    }
  } catch (error) {
    // Error during processing
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.emailRoute.update({
      where: { id: route.id },
      data: {
        status: 'failed',
        errorMessage,
        processedAt: new Date()
      }
    });

    console.error(`❌ Email routing error: ${email.from}`, error);

    return {
      success: false,
      error: errorMessage,
      routeId: route.id
    };
  }
};

/**
 * Get routing statistics
 */
export const getRoutingStats = async (days: number = 7) => {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const routes = await prisma.emailRoute.findMany({
    where: {
      createdAt: {
        gte: since
      }
    }
  });

  const total = routes.length;
  const routed = routes.filter(r => r.status === 'routed').length;
  const failed = routes.filter(r => r.status === 'failed').length;
  const pending = routes.filter(r => r.status === 'pending').length;

  // Calculate average confidence
  const avgConfidence = routes
    .filter(r => r.confidence !== null)
    .reduce((sum, r) => sum + (r.confidence || 0), 0) / (routed || 1);

  // Get most common assignees
  const assigneeCounts: Record<string, number> = {};
  routes.forEach(r => {
    if (r.routedTo) {
      assigneeCounts[r.routedTo] = (assigneeCounts[r.routedTo] || 0) + 1;
    }
  });

  const topAssignees = Object.entries(assigneeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([email, count]) => ({ email, count }));

  return {
    total,
    routed,
    failed,
    pending,
    successRate: total > 0 ? (routed / total) * 100 : 0,
    avgConfidence,
    topAssignees
  };
};

/**
 * Get email routing history
 */
export const getEmailRouteHistory = async (
  fromEmail?: string,
  status?: string,
  limit: number = 50
) => {
  interface EmailRouteFilterInput {
    fromEmail?: string;
    status?: string;
  }

  const where: EmailRouteFilterInput = {};

  if (fromEmail) {
    where.fromEmail = fromEmail;
  }

  if (status) {
    where.status = status;
  }

  return await prisma.emailRoute.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    },
    take: limit
  });
};

/**
 * Retry a failed email route
 */
export const retryEmailRoute = async (routeId: string): Promise<EmailRouteResult> => {
  const route = await prisma.emailRoute.findUnique({
    where: { id: routeId }
  });

  if (!route) {
    throw new Error('Route not found');
  }

  // Process the email again
  return await processIncomingEmail({
    from: route.fromEmail,
    subject: route.subject,
    body: route.body,
    metadata: route.metadata as Record<string, any>
  });
};

/**
 * SendGrid webhook handler
 * Parses SendGrid inbound parse webhook format
 */
export const parseSendGridWebhook = (body: any): IncomingEmail => {
  return {
    from: body.from || body.email,
    subject: body.subject || '(No subject)',
    body: body.text || body.html || '',
    metadata: {
      provider: 'sendgrid',
      to: body.to,
      cc: body.cc,
      headers: body.headers,
      attachments: body.attachments ? body.attachments.length : 0
    }
  };
};

/**
 * Mailgun webhook handler
 * Parses Mailgun webhook format
 */
export const parseMailgunWebhook = (body: any): IncomingEmail => {
  return {
    from: body.sender || body.from,
    subject: body.subject || '(No subject)',
    body: body['body-plain'] || body['body-html'] || '',
    metadata: {
      provider: 'mailgun',
      to: body.recipient,
      messageId: body['Message-Id'],
      timestamp: body.timestamp
    }
  };
};

/**
 * Generic email webhook handler
 * Attempts to parse common email formats
 */
export const parseGenericWebhook = (body: any): IncomingEmail => {
  return {
    from: body.from || body.sender || body.email || 'unknown@example.com',
    subject: body.subject || body.title || '(No subject)',
    body: body.body || body.text || body.content || body.message || '',
    metadata: {
      provider: 'generic',
      ...body
    }
  };
};

/**
 * Auto-forward email to assigned lawyer
 * This would integrate with your email service (SendGrid, Mailgun, etc.)
 */
export const forwardEmailToLawyer = async (
  routeId: string,
  lawyerEmail: string
): Promise<boolean> => {
  const route = await prisma.emailRoute.findUnique({
    where: { id: routeId }
  });

  if (!route) {
    return false;
  }

  // In a real implementation, you would call your email service API here
  // For example, SendGrid's API:
  //
  // await sendgrid.send({
  //   to: lawyerEmail,
  //   from: 'legal-triage@acme.corp',
  //   subject: `FWD: ${route.subject}`,
  //   text: `From: ${route.fromEmail}\n\n${route.body}`,
  //   replyTo: route.fromEmail
  // });

  console.log(`📬 Would forward email to ${lawyerEmail}:`);
  console.log(`   From: ${route.fromEmail}`);
  console.log(`   Subject: ${route.subject}`);

  return true;
};

/**
 * Send auto-reply to sender
 */
export const sendAutoReply = async (
  routeId: string,
  customMessage?: string
): Promise<boolean> => {
  const route = await prisma.emailRoute.findUnique({
    where: { id: routeId }
  });

  if (!route || !route.routedTo) {
    return false;
  }

  const lawyer = await getLawyerByEmail(route.routedTo);
  const lawyerName = lawyer ? `${lawyer.firstName} ${lawyer.lastName}` : route.routedTo;

  const message = customMessage || `
Thank you for contacting Acme Legal.

Your request has been automatically routed to ${lawyerName} (${route.routedTo}) based on the nature of your inquiry.

They will respond to you shortly.

Best regards,
Acme Legal Triage System
  `.trim();

  // In a real implementation, you would send this email
  // For now, just log it
  console.log(`📧 Would send auto-reply to ${route.fromEmail}:`);
  console.log(message);

  return true;
};
