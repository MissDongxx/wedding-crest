import { render } from '@react-email/components';

import { EmailConfigs, EmailMessage, EmailProvider, EmailSendResult } from '.';

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
 * Split a `Name <user@example.com>` string into its parts. A bare address is
 * returned as `email` only, so callers can keep using the configured default
 * for whichever half is missing.
 */
export function parseEmailAddress(value?: string): {
  name?: string;
  email?: string;
} {
  const raw = String(value || '').trim();
  if (!raw) {
    return {};
  }

  const angled = raw.match(/^(.*?)\s*<([^<>]+)>\s*$/);
  if (angled) {
    const name = angled[1].trim().replace(/^["']|["']$/g, '').trim();
    return { name: name || undefined, email: angled[2].trim() };
  }

  return { email: raw };
}

/**
 * Brevo answers `missing_parameter: sender name is missing` when `sender.name`
 * is sent as an empty string (the admin "Brevo Sender Name" setting is a free
 * text field and is routinely saved blank). Never forward a blank name.
 */
export function resolveSenderName(address: string): string {
  const localPart = address.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  if (!localPart) {
    return 'Mailer';
  }

  return localPart.replace(/\b[a-z]/g, (character) =>
    character.toUpperCase()
  );
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

      // Accept both a bare address and a `Name <address>` override.
      const override = parseEmailAddress(email.from);
      const senderEmail =
        override.email || String(this.configs.defaultFromEmail || '').trim();
      const senderName =
        override.name ||
        String(this.configs.defaultFromName || '').trim() ||
        resolveSenderName(senderEmail);

      if (!senderEmail) {
        return {
          success: false,
          error: 'Brevo sender email is not configured',
          provider: this.name,
        };
      }

      const payload: any = {
        sender: {
          name: senderName,
          email: senderEmail,
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
        let errorMessage =
          errorData.message || response.statusText || 'Brevo API Error';

        // Include Brevo error code if available
        if (errorData.code) {
          errorMessage = `${errorData.code}: ${errorMessage}`;
        }

        return {
          success: false,
          error: errorMessage,
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
