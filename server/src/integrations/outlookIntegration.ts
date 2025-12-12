import { Client } from '@microsoft/microsoft-graph-client';
import { IncomingEmail, EmailResponse, processIncomingEmail } from '../emailProcessor';

/**
 * Outlook/Microsoft 365 Integration for automated email processing
 *
 * Setup Instructions:
 * 1. Go to Azure Portal (portal.azure.com)
 * 2. Register an application in Azure AD
 * 3. Add Microsoft Graph API permissions: Mail.Read, Mail.Send, Mail.ReadWrite
 * 4. Create a client secret
 * 5. Set OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TENANT_ID in .env
 *
 * For production, use app-only authentication with certificate
 */

interface OutlookConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  userEmail?: string; // For delegated access
}

export class OutlookIntegration {
  private client: Client;
  private config: OutlookConfig;
  private accessToken: string | null = null;

  constructor(config: OutlookConfig) {
    this.config = config;
    this.initializeClient();
  }

  /**
   * Initialize Microsoft Graph client
   */
  private async initializeClient() {
    // Get access token
    this.accessToken = await this.getAccessToken();

    // Create Graph client
    this.client = Client.init({
      authProvider: (done) => {
        done(null, this.accessToken!);
      }
    });
  }

  /**
   * Get access token using client credentials flow
   */
  private async getAccessToken(): Promise<string> {
    const tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Create subscription for email notifications (webhook)
   * Requires a publicly accessible webhook URL
   */
  async createSubscription(webhookUrl: string, userEmail: string): Promise<any> {
    const subscription = {
      changeType: 'created',
      notificationUrl: webhookUrl,
      resource: `/users/${userEmail}/mailFolders('Inbox')/messages`,
      expirationDateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      clientState: 'secretClientValue' // For validation
    };

    return await this.client.api('/subscriptions').post(subscription);
  }

  /**
   * Poll inbox for new unread emails
   */
  async pollInbox(userEmail: string, maxResults: number = 10): Promise<IncomingEmail[]> {
    try {
      // Query for unread emails in inbox
      const response = await this.client
        .api(`/users/${userEmail}/mailFolders/Inbox/messages`)
        .filter('isRead eq false')
        .top(maxResults)
        .select('id,from,toRecipients,subject,bodyPreview,body,receivedDateTime')
        .get();

      const messages = response.value || [];

      if (messages.length === 0) {
        console.log(`📭 No new emails for ${userEmail}`);
        return [];
      }

      console.log(`📬 Found ${messages.length} new emails for ${userEmail}`);

      return messages.map((msg: any) => this.parseOutlookMessage(msg));
    } catch (error) {
      console.error(`Error polling Outlook inbox for ${userEmail}:`, error);
      throw error;
    }
  }

  /**
   * Parse Outlook message to IncomingEmail format
   */
  private parseOutlookMessage(message: any): IncomingEmail {
    const from = message.from?.emailAddress?.address || '';
    const to = message.toRecipients?.[0]?.emailAddress?.address || '';
    const subject = message.subject || '(no subject)';
    const body = message.body?.content || message.bodyPreview || '';
    const html = message.body?.contentType === 'html' ? body : undefined;
    const plainBody = message.body?.contentType === 'text' ? body : message.bodyPreview;

    return {
      from,
      to,
      subject,
      body: plainBody,
      html,
      timestamp: new Date(message.receivedDateTime),
      messageId: message.id
    };
  }

  /**
   * Send email response
   */
  async sendEmail(fromEmail: string, response: EmailResponse): Promise<void> {
    try {
      const message = {
        subject: response.subject,
        body: {
          contentType: response.html ? 'HTML' : 'Text',
          content: response.html || response.body
        },
        toRecipients: [
          {
            emailAddress: {
              address: response.to
            }
          }
        ],
        ccRecipients: response.cc?.map(email => ({
          emailAddress: { address: email }
        })) || [],
        replyTo: response.replyTo ? [{
          emailAddress: { address: response.replyTo }
          }] : []
      };

      await this.client
        .api(`/users/${fromEmail}/sendMail`)
        .post({
          message,
          saveToSentItems: true
        });

      console.log(`✅ Email sent to ${response.to} from ${fromEmail}`);
    } catch (error) {
      console.error('Error sending Outlook email:', error);
      throw error;
    }
  }

  /**
   * Mark email as read
   */
  async markAsRead(userEmail: string, messageId: string): Promise<void> {
    await this.client
      .api(`/users/${userEmail}/messages/${messageId}`)
      .patch({
        isRead: true
      });
  }

  /**
   * Process all unread emails for a user
   */
  async processUnreadEmails(userEmail: string): Promise<{ processed: number; failed: number }> {
    const incomingEmails = await this.pollInbox(userEmail);
    let processed = 0;
    let failed = 0;

    for (const email of incomingEmails) {
      try {
        console.log(`🔄 Processing email from ${email.from}: "${email.subject}"`);

        // Process through triage system
        const response = await processIncomingEmail(email);

        if (response) {
          // Send automated response from the triage mailbox (e.g., legal-triage@acme.corp)
          await this.sendEmail(userEmail, response);

          // Mark as read
          if (email.messageId) {
            await this.markAsRead(userEmail, email.messageId);
          }

          processed++;
        }
      } catch (error) {
        console.error(`Failed to process email from ${email.from}:`, error);
        failed++;
      }
    }

    console.log(`📊 Outlook processing complete for ${userEmail}: ${processed} processed, ${failed} failed`);

    return { processed, failed };
  }

  /**
   * Process emails for multiple shared mailboxes
   * Useful for monitoring legal@acme.corp, help@acme.corp, etc.
   */
  async processMultipleMailboxes(mailboxes: string[]): Promise<Map<string, { processed: number; failed: number }>> {
    const results = new Map<string, { processed: number; failed: number }>();

    for (const mailbox of mailboxes) {
      try {
        const result = await this.processUnreadEmails(mailbox);
        results.set(mailbox, result);
      } catch (error) {
        console.error(`Error processing mailbox ${mailbox}:`, error);
        results.set(mailbox, { processed: 0, failed: 0 });
      }
    }

    return results;
  }
}

/**
 * Start Outlook automation loop
 * Polls inbox(es) every N seconds
 */
export const startOutlookAutomation = (
  mailboxes: string[], // e.g., ['legal-triage@acme.corp', 'legal@acme.corp']
  intervalSeconds: number = 60
): NodeJS.Timeout => {
  const outlook = new OutlookIntegration({
    clientId: process.env.OUTLOOK_CLIENT_ID!,
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET!,
    tenantId: process.env.OUTLOOK_TENANT_ID!
  });

  console.log(`🚀 Starting Outlook automation for ${mailboxes.length} mailboxes (polling every ${intervalSeconds} seconds)`);

  const interval = setInterval(async () => {
    try {
      await outlook.processMultipleMailboxes(mailboxes);
    } catch (error) {
      console.error('Error in Outlook automation loop:', error);
    }
  }, intervalSeconds * 1000);

  // Process immediately on start
  outlook.processMultipleMailboxes(mailboxes).catch(console.error);

  return interval;
};
