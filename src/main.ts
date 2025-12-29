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
  const allowAllOrigins = allowedOrigins.includes('*');
  const allowLocalhostAnyPort =
    allowedOrigins.includes('http://localhost') || allowedOrigins.includes('http://127.0.0.1');

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origin === 'null') {
        callback(null, true);
        return;
      }

      if (allowAllOrigins || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (allowLocalhostAnyPort) {
        if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
          callback(null, true);
          return;
        }
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });

  // WebSocket adapter (native ws)
  app.useWebSocketAdapter(new WsAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Render utilise process.env.PORT dynamiquement
  const port = process.env.PORT || configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Application is running on port ${port}`);
}
bootstrap();
