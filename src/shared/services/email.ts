import {
  BrevoProvider,
  EmailManager,
  ResendProvider,
} from '@/extensions/email';
import { Configs, getAllConfigs } from '@/shared/models/config';

/**
 * get email service with configs
 */
export function getEmailServiceWithConfigs(configs: Configs) {
  const emailManager = new EmailManager();

  if (configs.resend_api_key) {
    emailManager.addProvider(
      new ResendProvider({
        apiKey: configs.resend_api_key,
        defaultFrom: configs.resend_sender_email,
      })
    );
  }

  if (configs.brevo_api_key) {
    emailManager.addProvider(
      new BrevoProvider({
        apiKey: configs.brevo_api_key,
        defaultFromEmail: configs.brevo_sender_email,
        defaultFromName: configs.brevo_sender_name,
      })
    );
  }

  return emailManager;
}

/**
 * global email service
 */
let emailService: EmailManager | null = null;

/**
 * get email service instance
 */
export async function getEmailService(
  configs?: Configs
): Promise<EmailManager> {
  if (!configs) {
    configs = await getAllConfigs();
  }
  emailService = getEmailServiceWithConfigs(configs);

  return emailService;
}
