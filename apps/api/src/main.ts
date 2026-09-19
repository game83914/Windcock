import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 預設不信任 proxy：直連部署時信任 X-Forwarded-For 等於允許偽造 IP 繞過限流。
  // 只有在反向代理之後運行時，才設 TRUST_PROXY=true。
  const trustProxy = process.env.TRUST_PROXY === 'true';
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxy ? 1 : false);
  app.setGlobalPrefix('api/v1');
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? corsOrigins : true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('輿論測風向 API')
    .setDescription('社群平台與議題投票 API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}
bootstrap();
