import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const PORT = process.env.PORT || 3827;

  const allowedOrigins = [
    'https://xfibot.xyz',
    'https://a6e86801e7f8.ngrok-free.app',
  ];

  const regexWhitelist = [
    /^http:\/\/localhost:\d+$/, // localhost:port
    /^http:\/\/127\.0\.0\.1:\d+$/, // 127.0.0.1:port
    /^https:\/\/.*\.?xfibot\.xyz$/, // any subdomain of discreet.fan
    /^https:\/\/.*\.?xfibot\.xyz$/, // any subdomain of discreet.fans
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow Postman/curl

      const allowed =
        allowedOrigins.includes(origin) ||
        regexWhitelist.some((regex) => regex.test(origin));

      if (allowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  });

  app.use(cookieParser());

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('SEI-XFI')
    .setDescription('sei xFi Server APIs')
    .setVersion('1.0.0')
    .addServer(`http://localhost:${PORT}`, 'Local environment')
    .addServer(`https://api.xfibot.xyz/xfi/`, 'Production Server')

    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api/docs', app, document);
  await app.listen(PORT);
}
bootstrap();
