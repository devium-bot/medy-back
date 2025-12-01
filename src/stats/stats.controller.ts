import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { AchievementsService } from '../achievements/achievements.service';

@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Post('session')
  async recordSession(
    @GetUser() user: any,
    @Body() body: { score: number; total: number; mode?: string },
  ) {
    const awarded = await this.achievements.onSoloSession(String(user._id), {
      score: Number(body?.score || 0),
      total: Number(body?.total || 0),
      mode: body?.mode,
    });
    return { success: true, awarded: Array.isArray(awarded) ? awarded : [] };
  }
}
