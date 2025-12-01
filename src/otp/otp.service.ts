import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import Twilio from 'twilio';
import { OtpEntry, OtpEntryDocument } from './otp.schema';

const OTP_VALIDITY_MS = 5 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private client: ReturnType<typeof Twilio> | null;
  private fromNumber: string | null;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(OtpEntry.name)
    private readonly otpModel: Model<OtpEntryDocument>,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID')?.trim();
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN')?.trim();
    this.fromNumber = this.configService
      .get<string>('TWILIO_PHONE_NUMBER')
      ?.trim() ?? null;

    if (!accountSid || !authToken) {
      this.logger.warn(
        'Les identifiants Twilio sont manquants. Envoi SMS OTP désactivé.',
      );
      this.client = null;
      return;
    }

    try {
      this.client = Twilio(accountSid, authToken); // pas de 'new'
    } catch (error) {
      this.logger.error('Initialisation Twilio échouée', error as Error);
      this.client = null;
    }
  }

  private async canSendNow(phone: string) {
    const existing = await this.otpModel.findOne({ phone });
    if (!existing) return true;
    const nextAllowedAt =
      existing.lastSentAt.getTime() + OTP_RESEND_DELAY_MS;
    if (nextAllowedAt > Date.now()) {
      return {
        ok: false,
        retryAfterMs: nextAllowedAt - Date.now(),
      };
    }
    return true;
  }

  private normalizePhoneNumber(rawPhone: string) {
    if (!rawPhone) {
      return null;
    }

    const trimmed = rawPhone.trim();
    if (trimmed.startsWith('+')) {
      return trimmed;
    }

    // Handle Algerian numbers: 0XXXXXXXXX -> +213XXXXXXXXX
    const algerianLocal = /^0(\d{9})$/;
    if (algerianLocal.test(trimmed)) {
      return `+213${trimmed.slice(1)}`;
    }

    const algerianWithoutZero = /^213(\d{9})$/;
    if (algerianWithoutZero.test(trimmed)) {
      return `+${trimmed}`;
    }

    // Already contains international prefix like 00213...
    const internationalPrefix = /^00\d+$/;
    if (internationalPrefix.test(trimmed)) {
      return `+${trimmed.slice(2)}`;
    }

    this.logger.warn(
      `Format du numéro inattendu (${trimmed}). Assurez-vous d'utiliser le format national (0XXXXXXXXX) ou international (+213XXXXXXXXX).`,
    );
    return trimmed;
  }

  async sendOtp(phone: string) {
    const normalizedPhone = this.normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return {
        success: false,
        error: 'Numéro de téléphone invalide.',
      };
    }

    const sendCheck = await this.canSendNow(normalizedPhone);
    if (sendCheck !== true) {
      return {
        success: false,
        error: `Veuillez patienter ${Math.ceil(sendCheck.retryAfterMs / 1000)}s avant de redemander un code.`,
      };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // OTP 6 chiffres
    const expiresAt = new Date(Date.now() + OTP_VALIDITY_MS);
    const codeHash = createHash('sha256').update(code).digest('hex');

    await this.otpModel.findOneAndUpdate(
      { phone: normalizedPhone },
      {
        phone: normalizedPhone,
        codeHash,
        expiresAt,
        lastSentAt: new Date(),
        attempts: 0,
      },
      { upsert: true, new: true },
    );

    if (!this.client || !this.fromNumber) {
      this.logger.debug(
        `OTP généré pour ${normalizedPhone} (mode sans SMS): ${code}`,
      );
      return {
        success: true,
        sid: 'local-fallback',
        message: 'Service SMS non configuré. Code OTP consigné dans les logs.',
      };
    }

    try {
      const message = await this.client.messages.create({
        body: `Votre code OTP est : ${code}`,
        from: this.fromNumber,
        to: normalizedPhone,
      });

      return { success: true, sid: message.sid };
    } catch (error) {
      const err = error as Error;
      this.logger.error('Envoi OTP Twilio échoué', err);
      const message =
        err.message === 'username is required'
          ? 'Paramètres Twilio manquants ou invalides (Account SID).'
          : err.message;
      return { success: false, error: message };
    }
  }

  async verifyOtp(phone: string, code: string) {
    return this.verifyOtpAsync(phone, code);
  }

  private async verifyOtpAsync(phone: string, code: string) {
    const normalizedPhone = this.normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return false;
    }
    const record = await this.otpModel.findOne({ phone: normalizedPhone });
    if (!record) return false;
    if (record.expiresAt.getTime() < Date.now()) {
      await this.otpModel.deleteOne({ phone: normalizedPhone });
      return false;
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await this.otpModel.deleteOne({ phone: normalizedPhone });
      return false;
    }

    const incomingHash = createHash('sha256').update(code).digest('hex');
    const isValid = record.codeHash === incomingHash;

    if (!isValid) {
      await this.otpModel.updateOne(
        { phone: normalizedPhone },
        { $inc: { attempts: 1 } },
      );
      return false;
    }

    await this.otpModel.deleteOne({ phone: normalizedPhone });
    return true;
  }
}
