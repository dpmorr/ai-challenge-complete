import { google } from 'googleapis';
import { IncomingEmail, EmailResponse, processIncomingEmail } from '../emailProcessor';

/**
 * Gmail Integration for automated email processing
 *
 * Setup Instructions:
 * 1. Go to Google Cloud Console (console.cloud.google.com)
 * 2. Create a new project or select existing
 * 3. Enable Gmail API
 * 4. Create OAuth 2.0 credentials (Desktop app)
 * 5. Download credentials.json
 * 6. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN in .env
 *
 * For service account (recommended for production):
 * 1. Create a service account with domain-wide delegation
 * 2. Enable Gmail API
 * 3. Set GMAIL_SERVICE_ACCOUNT_EMAIL and GMAIL_PRIVATE_KEY in .env
 */

interface GmailConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  serviceAccountEmail?: string;
  privateKey?: string;
  userEmail?: string; // Email to impersonate (for service accounts)
}

export class GmailIntegration {
  private gmail: any;
  private config: GmailConfig;

  constructor(config: GmailConfig) {
    this.config = config;
    this.initializeClient();
  }

  private initializeClient() {
    const auth = new google.auth.OAuth2(
      this.config.clientId || process.env.GMAIL_CLIENT_ID,
      this.config.clientSecret || process.env.GMAIL_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob' // For desktop apps
    );

    if (this.config.refreshToken || process.env.GMAIL_REFRESH_TOKEN) {
      auth.setCredentials({
        refresh_token: this.config.refreshToken || process.env.GMAIL_REFRESH_TOKEN
      });
    }

    this.gmail = google.gmail({ version: 'v1', auth });
  }

  /**
   * Watch inbox for new emails and process them automatically
   * Uses Gmail Push Notifications (requires webhook setup)
   */
  async watchInbox(): Promise<void> {
    try {
      const response = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: process.env.GMAIL_PUBSUB_TOPIC, // e.g., 'projects/myproject/topics/gmail'
          labelIds: ['INBOX', 'UNREAD']
        }
      });

      console.log('📬 Gmail watch started:', response.data);
    } catch (error) {
      console.error('Error setting up Gmail watch:', error);
      throw error;
    }
  }

  /**
   * Poll inbox for new unread emails (alternative to push notifications)
   * Use this if you don't have webhook infrastructure
   */
  async pollInbox(maxResults: number = 10): Promise<IncomingEmail[]> {
    try {
      // List unread messages
      const listResponse = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread in:inbox', // Query for unread emails in inbox
        maxResults
      });

      const messages = listResponse.data.messages || [];

      if (messages.length === 0) {
        console.log('📭 No new emails');
        return [];
      }

      console.log(`📬 Found ${messages.length} new emails`);

      // Fetch full message details
      const emails: IncomingEmail[] = [];

      for (const message of messages) {
        const fullMessage = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const email = this.parseGmailMessage(fullMessage.data);
        if (email) {
          emails.push(email);
        }
      }

      return emails;
    } catch (error) {
      console.error('Error polling Gmail inbox:', error);
      throw error;
    }
  }

  /**
   * Parse Gmail message format to IncomingEmail
   */
  private parseGmailMessage(message: any): IncomingEmail | null {
    try {
      const headers = message.payload.headers;
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

      const from = getHeader('From');
      const to = getHeader('To');
      const subject = getHeader('Subject') || '(no subject)';
      const date = getHeader('Date');

      // Extract email address from "Name <email@domain.com>" format
      const fromEmail = from?.match(/<(.+?)>/)? [1] || from;

      // Get email body
      let body = '';
      let html = '';

      if (message.payload.parts) {
        for (const part of message.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/html' && part.body.data) {
            html = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        }
      } else if (message.payload.body.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      }

      return {
        from: fromEmail,
        to: to || '',
        subject,
        body,
        html,
        timestamp: date ? new Date(date) : new Date(),
        messageId: message.id
      };
    } catch (error) {
      console.error('Error parsing Gmail message:', error);
      return null;
    }
  }

  /**
   * Send email response
   */
  async sendEmail(response: EmailResponse): Promise<void> {
    try {
      const message = this.createMimeMessage(response);
      const encodedMessage = Buffer.from(message).toString('base64url');

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log(`✅ Email sent to ${response.to}`);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Create MIME message for sending
   */
  private createMimeMessage(response: EmailResponse): string {
    const boundary = '----=_Part_0_' + Date.now();
    const nl = '\r\n';

    let message = `To: ${response.to}${nl}`;

    if (response.cc && response.cc.length > 0) {
      message += `Cc: ${response.cc.join(', ')}${nl}`;
    }

    if (response.replyTo) {
      message += `Reply-To: ${response.replyTo}${nl}`;
    }

    message += `Subject: ${response.subject}${nl}`;
    message += `MIME-Version: 1.0${nl}`;
    message += `Content-Type: multipart/alternative; boundary="${boundary}"${nl}${nl}`;

    // Plain text part
    message += `--${boundary}${nl}`;
    message += `Content-Type: text/plain; charset=UTF-8${nl}${nl}`;
    message += response.body + nl;

    // HTML part (if provided)
    if (response.html) {
      message += `--${boundary}${nl}`;
      message += `Content-Type: text/html; charset=UTF-8${nl}${nl}`;
      message += response.html + nl;
    }

    message += `--${boundary}--`;

    return message;
  }

  /**
   * Mark email as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    });
  }

  /**
   * Process all unread emails automatically
   */
  async processUnreadEmails(): Promise<{ processed: number; failed: number }> => {
    const incomingEmails = await this.pollInbox();
    let processed = 0;
    let failed = 0;

    for (const email of incomingEmails) {
      try {
        console.log(`🔄 Processing email from ${email.from}: "${email.subject}"`);

        // Process through triage system
        const response = await processIncomingEmail(email);

        if (response) {
          // Send automated response
          await this.sendEmail(response);

          // Mark as read
          if (email.messageId) {
            await this.markAsRead(email.messageId);
          }

          processed++;
        }
      } catch (error) {
        console.error(`Failed to process email from ${email.from}:`, error);
        failed++;
      }
    }

    console.log(`📊 Gmail processing complete: ${processed} processed, ${failed} failed`);

    return { processed, failed };
  }
}

/**
 * Start Gmail automation loop
 * Polls inbox every N seconds
 */
export const startGmailAutomation = (intervalSeconds: number = 60): NodeJS.Timeout => {
  const gmail = new GmailIntegration({
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN
  });

  console.log(`🚀 Starting Gmail automation (polling every ${intervalSeconds} seconds)`);

  const interval = setInterval(async () => {
    try {
      await gmail.processUnreadEmails();
    } catch (error) {
      console.error('Error in Gmail automation loop:', error);
    }
  }, intervalSeconds * 1000);

  // Process immediately on start
  gmail.processUnreadEmails().catch(console.error);

  return interval;
};
