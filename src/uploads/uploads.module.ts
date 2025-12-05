import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, UsersModule],
  providers: [UploadsService],
  controllers: [UploadsController],
})
export class UploadsModule {}
