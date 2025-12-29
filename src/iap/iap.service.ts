import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { UsersService } from '../users/users.service';

const APPLE_VERIFY_PROD = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

type IapValidationResult = {
  productId: string;
  orderId?: string;
  expiresAt?: Date;
};

@Injectable()
export class IapService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async confirmPurchase(userId: string, payload: { platform: 'ios' | 'android'; productId: string; receipt?: string; purchaseToken?: string; transactionId?: string }) {
    const { platform } = payload;
    const result =
      platform === 'ios'
        ? await this.validateIosReceipt(payload)
        : await this.validateAndroidPurchase(payload);

    if (!result?.expiresAt || result.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Achat expiré ou invalide');
    }

    await this.usersService.applySubscriptionWithDates(userId, {
      startDate: new Date(),
      endDate: result.expiresAt,
      provider: 'iap',
      paymentRef: result.orderId || payload.transactionId,
    });

    return {
      ok: true,
      productId: result.productId,
      expiresAt: result.expiresAt,
    };
  }

  private async validateIosReceipt(payload: { productId: string; receipt?: string }): Promise<IapValidationResult> {
    const receipt = payload.receipt;
    if (!receipt) {
      throw new BadRequestException('Reçu iOS manquant');
    }
    const sharedSecret = this.configService.get<string>('IAP_APPLE_SHARED_SECRET');
    if (!sharedSecret) {
      throw new BadRequestException('IAP_APPLE_SHARED_SECRET manquant');
    }

    const baseBody = {
      'receipt-data': receipt,
      password: sharedSecret,
      'exclude-old-transactions': true,
    };

    const response = await this.verifyAppleReceipt(APPLE_VERIFY_PROD, baseBody);
    const data =
      response.status === 21007
        ? await this.verifyAppleReceipt(APPLE_VERIFY_SANDBOX, baseBody)
        : response;

    if (data.status !== 0) {
      throw new BadRequestException(`Reçu iOS invalide (status ${data.status})`);
    }

    const items = Array.isArray(data?.latest_receipt_info)
      ? data.latest_receipt_info
      : Array.isArray(data?.receipt?.in_app)
        ? data.receipt.in_app
        : [];

    const matching = items
      .filter((item: any) => item.product_id === payload.productId)
      .sort((a: any, b: any) => Number(b.expires_date_ms || 0) - Number(a.expires_date_ms || 0));

    const latest = matching[0];
    if (!latest?.expires_date_ms) {
      throw new BadRequestException('Reçu iOS sans date d’expiration');
    }

    return {
      productId: payload.productId,
      orderId: latest.original_transaction_id || latest.transaction_id,
      expiresAt: new Date(Number(latest.expires_date_ms)),
    };
  }

  private async verifyAppleReceipt(url: string, body: Record<string, any>) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new BadRequestException('Vérification Apple impossible');
    }
    return res.json();
  }

  private async validateAndroidPurchase(payload: { productId: string; purchaseToken?: string }): Promise<IapValidationResult> {
    const purchaseToken = payload.purchaseToken;
    if (!purchaseToken) {
      throw new BadRequestException('purchaseToken Android manquant');
    }

    const packageName = this.configService.get<string>('GOOGLE_PLAY_PACKAGE_NAME');
    if (!packageName) {
      throw new BadRequestException('GOOGLE_PLAY_PACKAGE_NAME manquant');
    }

    const serviceAccountJson = this.configService.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      throw new BadRequestException('GOOGLE_PLAY_SERVICE_ACCOUNT manquant');
    }

    let credentials: Record<string, any>;
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (e) {
      throw new BadRequestException('GOOGLE_PLAY_SERVICE_ACCOUNT invalide (JSON attendu)');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const publisher = google.androidpublisher({ version: 'v3', auth });

    const res = await publisher.purchases.subscriptions.get({
      packageName,
      subscriptionId: payload.productId,
      token: purchaseToken,
    });

    const data = res.data || {};
    const expiryMillis = data.expiryTimeMillis ? Number(data.expiryTimeMillis) : NaN;
    if (!expiryMillis || Number.isNaN(expiryMillis)) {
      throw new BadRequestException('Achat Android sans date d’expiration');
    }

    return {
      productId: payload.productId,
      orderId: data.orderId || undefined,
      expiresAt: new Date(expiryMillis),
    };
  }
}
