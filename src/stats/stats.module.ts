import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { QcmAttempt, QcmAttemptSchema } from './schemas/qcm-attempt.schema';
import { UsersModule } from '../users/users.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QcmAttempt.name, schema: QcmAttemptSchema },
    ]),
    UsersModule,
    AchievementsModule,
  ],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
