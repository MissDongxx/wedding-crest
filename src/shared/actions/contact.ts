'use server';

import { getEmailService } from '@/shared/services/email';

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function sendContactEmail(data: ContactFormData) {
  try {
    const emailService = await getEmailService();

    const supportEmail = 'support@weddingcrestdesign.com';
    const siteName = 'Wedding Crest Design';

    const result = await emailService.sendEmail({
      to: supportEmail,
      subject: `[Contact Form] ${data.subject || 'New Message'}`,
      replyTo: data.email,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${data.name || 'N/A'}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <p><strong>Message:</strong></p>
        <div style="white-space: pre-wrap; padding: 15px; background: #f5f5f5; border-radius: 5px;">
          ${data.message}
        </div>
        <hr />
        <p style="font-size: 12px; color: #666;">
          Sent from ${siteName} Contact Form
        </p>
      `,
    });

    if (!result.success) {
      console.error('Failed to send contact email:', result.error);
      return { success: false, error: result.error || 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in sendContactEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
