import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

type VerificationMailParams = {
  to: string;
  verificationLink: string;
  token: string;
  username?: string | null;
  expiresInMinutes: number;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private useResend: boolean;
  private resendApiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    this.useResend = Boolean(this.resendApiKey);
  }

  private getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass || !port) {
      throw new Error('SMTP non configuré');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    return this.transporter;
  }

  async sendEmailVerification({
    to,
    verificationLink,
    token,
    username,
    expiresInMinutes,
  }: VerificationMailParams) {
    const from = this.configService.get<string>('EMAIL_FROM');

    const salutation = username ? `Bonjour ${username},` : 'Bonjour,';
    const code = token;
    const html = `
      <p>${salutation}</p>
      <p>Merci de votre inscription sur QCM Med.</p>
      <p>Votre code de confirmation est :</p>
      <p style="font-size:20px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>Vous pouvez aussi confirmer via ce lien : <a href="${verificationLink}" style="color:#2563eb;">Confirmer mon adresse e-mail</a></p>
      <p>Ce code/lien expirera dans ${expiresInMinutes} minutes.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
      <p>L'équipe QCM Med</p>
    `;

    const text = [
      username ? `Bonjour ${username},` : 'Bonjour,',
      '',
      'Merci de votre inscription sur QCM Med.',
      'Votre code de confirmation est :',
      code,
      '',
      'Ou confirmez via ce lien :',
      verificationLink,
      '',
      `Ce code/lien expirera dans ${expiresInMinutes} minutes.`,
      '',
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
      '',
      "L'équipe QCM Med",
    ].join('\n');

    try {
      if (this.useResend && this.resendApiKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to,
            subject: 'Confirmez votre adresse e-mail',
            html,
            text,
          }),
        });
      } else {
        const transporter = this.getTransporter();
        await transporter.sendMail({
          from,
          to,
          subject: 'Confirmez votre adresse e-mail',
          html,
          text,
        });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        "Erreur lors de l'envoi du mail de vérification",
        err.stack,
      );
      throw error;
    }
  }
}
