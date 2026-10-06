'use server';

import { getEmailService } from '@/shared/services/email';

const MAX_NAME_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] || character
  );
}

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function sendContactEmail(data: ContactFormData) {
  try {
    const name = String(data.name || '').trim();
    const email = String(data.email || '')
      .trim()
      .toLowerCase();
    const subject = String(data.subject || '').trim();
    const message = String(data.message || '').trim();

    if (
      name.length < 2 ||
      name.length > MAX_NAME_LENGTH ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      subject.length < 5 ||
      subject.length > MAX_SUBJECT_LENGTH ||
      message.length < 10 ||
      message.length > MAX_MESSAGE_LENGTH
    ) {
      return { success: false, error: 'Please check the form fields.' };
    }

    const emailService = await getEmailService();

    const supportEmail = 'support@weddingcrestdesign.com';
    const siteName = 'Wedding Crest Design';

    const result = await emailService.sendEmail({
      to: supportEmail,
      subject: `[Contact Form] ${subject}`,
      replyTo: email,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong></p>
        <div style="white-space: pre-wrap; padding: 15px; background: #f5f5f5; border-radius: 5px;">
          ${escapeHtml(message)}
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
