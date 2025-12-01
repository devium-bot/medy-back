import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const allowedOriginsEnv = configService.get<string>('ALLOWED_ORIGINS');
  const parsedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
  const defaultOrigins = ['http://localhost:5173'];
  const allowedOrigins = parsedOrigins.length ? parsedOrigins : defaultOrigins;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // WebSocket adapter (native ws)
  app.useWebSocketAdapter(new WsAdapter(app));

  // Permet de parser les requêtes JSON (activé par défaut, mais mieux d’être explicite)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés inconnues
      forbidNonWhitelisted: true, // Erreur si des propriétés inconnues sont envoyées
      transform: true, // Transforme les types automatiquement
    }),
  );

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
