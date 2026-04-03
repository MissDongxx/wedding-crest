import { VerificationCode } from '@/shared/blocks/email/verification-code';
import { respData, respErr } from '@/shared/lib/resp';
import { getEmailService } from '@/shared/services/email';

export async function POST(req: Request) {
  try {
    const { emails, subject } = await req.json();

    const emailService = await getEmailService();

    const result = await emailService.sendEmail({
      to: emails,
      subject: subject,
      react: VerificationCode({ code: '123455' }),
    });

    return respData(result);
  } catch (e) {
    return respErr('send email failed');
  }
}
