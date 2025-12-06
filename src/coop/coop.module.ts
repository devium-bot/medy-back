import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoopController } from './coop.controller';
import { CoopService } from './coop.service';
import {
  CoopSession,
  CoopSessionSchema,
} from './schemas/coop-session.schema';
import { FriendsModule } from '../friends/friends.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  Friendship,
  FriendshipSchema,
} from '../friends/schemas/friendship.schema';
import { Question } from '../questions/schemas/question.schema';
import { QuestionSchema } from '../questions/schemas/question.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { DailyUsageGuard } from '../common/guards/daily-usage.guard';
import { UsersModule } from '../users/users.module';
import { CoopAnswer, CoopAnswerSchema } from './schemas/coop-answer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CoopSession.name, schema: CoopSessionSchema },
      { name: Friendship.name, schema: FriendshipSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: User.name, schema: UserSchema },
      { name: CoopAnswer.name, schema: CoopAnswerSchema },
    ]),
    FriendsModule,
    RealtimeModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [CoopController],
  providers: [CoopService, DailyUsageGuard],
  exports: [CoopService],
})
export class CoopModule {}
