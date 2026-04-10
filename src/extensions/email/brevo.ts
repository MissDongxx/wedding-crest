import { render } from '@react-email/components';

import {
  EmailConfigs,
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from '.';

/**
 * Brevo email provider configs
 * @docs https://developers.brevo.com/reference/sendtransacemail
 */
export interface BrevoConfigs extends EmailConfigs {
  apiKey: string;
  defaultFromEmail: string;
  defaultFromName?: string;
}

/**
 * Brevo email provider implementation using REST API (v3)
 */
export class BrevoProvider implements EmailProvider {
  readonly name = 'brevo';
  configs: BrevoConfigs;

  constructor(configs: BrevoConfigs) {
    this.configs = configs;
  }

  async sendEmail(email: EmailMessage): Promise<EmailSendResult> {
    try {
      let html = email.html;

      if (email.react) {
        // Explicitly render React to HTML
        html = await render(email.react);
      }

      const payload: any = {
        sender: {
          name: email.from ? undefined : this.configs.defaultFromName,
          email: email.from || this.configs.defaultFromEmail,
        },
        to: (Array.isArray(email.to) ? email.to : [email.to]).map((e) => ({
          email: e,
        })),
        subject: email.subject,
        htmlContent: html,
        textContent: email.text,
      };

      // Add optional CC/BCC if they exist
      if (email.cc) {
        payload.cc = (Array.isArray(email.cc) ? email.cc : [email.cc]).map(
          (e) => ({ email: e })
        );
      }
      if (email.bcc) {
        payload.bcc = (Array.isArray(email.bcc) ? email.bcc : [email.bcc]).map(
          (e) => ({ email: e })
        );
      }

      // Add ReplyTo if exists
      if (email.replyTo) {
        payload.replyTo = { email: email.replyTo };
      }

      // Add Attachments if exist
      if (email.attachments) {
        payload.attachment = email.attachments.map((att) => ({
          name: att.filename,
          content:
            typeof att.content === 'string'
              ? att.content
              : Buffer.from(att.content).toString('base64'),
        }));
      }

      // Add Headers if exist
      if (email.headers) {
        payload.headers = email.headers;
      }

      // Add Tags if exist
      if (email.tags) {
        payload.tags = email.tags;
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': this.configs.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || response.statusText || 'Brevo API Error',
          provider: this.name,
        };
      }

      const result = await response.json();

      return {
        success: true,
        messageId: result.messageId,
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }
}

/**
 * Create Brevo provider with configs
 */
export function createBrevoProvider(configs: BrevoConfigs): BrevoProvider {
  return new BrevoProvider(configs);
}
