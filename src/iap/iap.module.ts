import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { IapController } from './iap.controller';
import { IapService } from './iap.service';

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [IapController],
  providers: [IapService],
})
export class IapModule {}
