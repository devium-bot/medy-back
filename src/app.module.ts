import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { QuestionsModule } from './questions/questions.module';
import { UniteModule } from './categorie/unites/unite.module';
import { ModuleModule } from './categorie/modules/module.module';
import { CoursModule } from './categorie/cours/cours.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StatsModule } from './stats/stats.module';
import { FriendsModule } from './friends/friends.module';
import { MailModule } from './mail/mail.module';
import { CoopModule } from './coop/coop.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AchievementsModule } from './achievements/achievements.module';
import { AiModule } from './ai/ai.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    // Charge les variables .env globalement
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const mongoUri = config.MONGO_URI ? String(config.MONGO_URI) : '';
        if (!mongoUri) {
          throw new Error('La variable MONGO_URI est requise.');
        }

        const portValue =
          config.PORT !== undefined ? Number(config.PORT) : 3000;
        if (Number.isNaN(portValue)) {
          throw new Error('La variable PORT doit être un nombre.');
        }

        const allowedOrigins = config.ALLOWED_ORIGINS
          ? String(config.ALLOWED_ORIGINS)
          : undefined;

        const jwtSecret = config.JWT_SECRET ? String(config.JWT_SECRET) : '';
        if (!jwtSecret) {
          throw new Error('La variable JWT_SECRET est requise.');
        }

        const jwtExpiresIn = config.JWT_EXPIRES_IN
          ? String(config.JWT_EXPIRES_IN)
          : '7d';

        const smtpHost = config.SMTP_HOST ? String(config.SMTP_HOST) : '';
        const smtpPortValue =
          config.SMTP_PORT !== undefined ? Number(config.SMTP_PORT) : 587;
        const smtpUser = config.SMTP_USER ? String(config.SMTP_USER) : '';
        const smtpPass = config.SMTP_PASS ? String(config.SMTP_PASS) : '';
        const resendKey = config.RESEND_API_KEY
          ? String(config.RESEND_API_KEY)
          : '';
        const useResend = Boolean(resendKey);
        const emailTransportOk =
          useResend ||
          (smtpHost && !Number.isNaN(smtpPortValue) && smtpUser && smtpPass);
        if (!emailTransportOk) {
          throw new Error(
            'Configurez RESEND_API_KEY ou SMTP_HOST/PORT/USER/PASS pour l’envoi d’e-mails.',
          );
        }

        const emailFrom = config.EMAIL_FROM ? String(config.EMAIL_FROM) : '';
        if (!emailFrom) {
          throw new Error('La variable EMAIL_FROM est requise.');
        }

        const emailVerificationEnabled =
          config.EMAIL_VERIFICATION_ENABLED !== undefined
            ? String(config.EMAIL_VERIFICATION_ENABLED).toLowerCase() !== 'false'
            : true;

        const verificationUrl = config.EMAIL_VERIFICATION_URL
          ? String(config.EMAIL_VERIFICATION_URL)
          : '';
        if (emailVerificationEnabled && !verificationUrl) {
          throw new Error('La variable EMAIL_VERIFICATION_URL est requise.');
        }

        // Expose validated + optional keys to ConfigService
        return {
          MONGO_URI: mongoUri,
          PORT: portValue,
          ADMIN_SETUP_TOKEN: config.ADMIN_SETUP_TOKEN
            ? String(config.ADMIN_SETUP_TOKEN)
            : undefined,
          ALLOWED_ORIGINS: allowedOrigins,
          JWT_SECRET: jwtSecret,
          JWT_EXPIRES_IN: jwtExpiresIn,
          SMTP_HOST: smtpHost || undefined,
          SMTP_PORT: Number.isNaN(smtpPortValue) ? undefined : smtpPortValue,
          SMTP_USER: smtpUser || undefined,
          SMTP_PASS: smtpPass || undefined,
          RESEND_API_KEY: resendKey || undefined,
          EMAIL_FROM: emailFrom,
          EMAIL_VERIFICATION_URL: verificationUrl,
          EMAIL_VERIFICATION_ENABLED: emailVerificationEnabled,
          // AI (optionnels)
          AI_PROVIDER: config.AI_PROVIDER ? String(config.AI_PROVIDER) : undefined,
          HF_API_TOKEN: config.HF_API_TOKEN ? String(config.HF_API_TOKEN) : undefined,
          AI_MODEL: config.AI_MODEL ? String(config.AI_MODEL) : undefined,
          HF_TEXT_MODEL: config.HF_TEXT_MODEL ? String(config.HF_TEXT_MODEL) : undefined,
          // HF Inference Providers (optionnels)
          HF_PROVIDER: config.HF_PROVIDER ? String(config.HF_PROVIDER) : undefined,
          HF_ENDPOINT_URL: config.HF_ENDPOINT_URL ? String(config.HF_ENDPOINT_URL) : undefined,
          HF_BASE_URL: config.HF_BASE_URL ? String(config.HF_BASE_URL) : undefined,
          IP_PROVIDER: config.IP_PROVIDER ? String(config.IP_PROVIDER) : undefined,
          IP_MODEL: config.IP_MODEL ? String(config.IP_MODEL) : undefined,
          // Groq (optionnels)
          GROQ_API_KEY: config.GROQ_API_KEY ? String(config.GROQ_API_KEY) : undefined,
          GROQ_MODEL: config.GROQ_MODEL ? String(config.GROQ_MODEL) : undefined,
          AI_MAX_DAILY_PER_USER:
            config.AI_MAX_DAILY_PER_USER !== undefined
              ? Number(config.AI_MAX_DAILY_PER_USER)
              : undefined,
          // Replicate (optionnels)
          REPLICATE_API_TOKEN: config.REPLICATE_API_TOKEN ? String(config.REPLICATE_API_TOKEN) : undefined,
          REPLICATE_MODEL: config.REPLICATE_MODEL ? String(config.REPLICATE_MODEL) : undefined,
          REPLICATE_VERSION: config.REPLICATE_VERSION ? String(config.REPLICATE_VERSION) : undefined,
          REPLICATE_BASE_URL: config.REPLICATE_BASE_URL ? String(config.REPLICATE_BASE_URL) : undefined,
        };
      },
    }),

    // Connexion MongoDB via variable d’environnement
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),

    AuthModule,
    UsersModule,
    UniteModule,
    ModuleModule,
    CoursModule,
    QuestionsModule,
    StatsModule,
    FriendsModule,
    MailModule,
    CoopModule,
    NotificationsModule,
    RealtimeModule,
    AchievementsModule,
    AiModule,
    PaymentsModule,
  ],
})
export class AppModule {}
