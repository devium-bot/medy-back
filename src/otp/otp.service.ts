import { Injectable, Logger } from '@nestjs/common';
import Twilio from 'twilio';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private client: ReturnType<typeof Twilio> | null;
  private fromNumber: string | null;

  // Stockage simple en mémoire pour exemple (production: Redis ou DB)
  private otpStore = new Map<string, { code: string; expiresAt: number }>();

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim() ?? null;

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

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // OTP 6 chiffres
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min de validité

    this.otpStore.set(normalizedPhone, { code, expiresAt });

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

  verifyOtp(phone: string, code: string) {
    const normalizedPhone = this.normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return false;
    }
    const record = this.otpStore.get(normalizedPhone);
    if (!record) return false;
    if (record.expiresAt < Date.now()) {
      this.otpStore.delete(normalizedPhone);
      return false;
    }
    const valid = record.code === code;
    if (valid) this.otpStore.delete(normalizedPhone);
    return valid;
  }
}
