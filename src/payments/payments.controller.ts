import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('chargily/init')
  async initChargily(@GetUser() user) {
    const fallbackUrl =
      this.configService.get<string>('CHARGILY_PAYMENT_LINK') ||
      'https://pay.chargily.com/test/payment-links/01kbb3w2j9w9tnn81t1ckeqxvf';
    // Ici on pourrait créer dynamiquement une facture via l'API Chargily.
    // Pour l'instant on renvoie un lien de paiement statique configurable.
    return {
      paymentUrl: fallbackUrl,
      amount: 2500,
      currency: 'DZD',
    };
  }

  @Post('chargily/webhook')
  async chargilyWebhook(@Req() req, @Body() body: any) {
    const secret = this.configService.get<string>('CHARGILY_WEBHOOK_SECRET');
    const signature = req.headers['x-chargily-signature'] as string;
    this.paymentsService.validateWebhook(signature, secret);

    const userId = body?.userId || body?.metadata?.userId;
    const paymentRef = body?.id || body?.paymentRef;
    if (!userId) {
      // Si pas d'user, on ignore silencieusement
      return { ok: true };
    }
    await this.paymentsService.activatePremium(userId, 12, paymentRef);
    return { ok: true };
  }
}
