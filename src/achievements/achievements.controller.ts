import { Controller, Get, UseGuards } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@Controller('achievements')
export class AchievementsController {
  constructor(private ach: AchievementsService) {}

  @Get()
  catalog() {
    return this.ach.catalog();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async mine(@GetUser() user: any) {
    return this.ach.listForUser(String(user._id));
  }

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  async summary(@GetUser() user: any) {
    return this.ach.summaryForUser(String(user._id));
  }
}

