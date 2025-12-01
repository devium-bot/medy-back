import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { OtpEntry, OtpEntrySchema } from './otp.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: OtpEntry.name, schema: OtpEntrySchema }]),
  ],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
