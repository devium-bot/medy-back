import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly usersService: UsersService) {}

  async activatePremium(userId: string, months = 12, paymentRef?: string) {
    return this.usersService.applySubscription(userId, {
      months,
      paidAt: new Date(),
      provider: 'chargily',
      paymentRef,
    });
  }

  validateWebhook(secretHeader: string | undefined, expected?: string) {
    if (!expected) return true; // no secret configured
    if (!secretHeader || secretHeader !== expected) {
      throw new UnauthorizedException('Signature webhook invalide');
    }
    return true;
  }
}
