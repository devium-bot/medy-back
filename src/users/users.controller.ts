import { Controller, Get, Patch, UseGuards, Body, Query, Post, Delete, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@GetUser() user) {
    return this.usersService.findById(user._id);
  }

  @Get('search')
  search(@Query('q') q: string, @Query('limit') limit = '10') {
    return this.usersService.searchUsers(q, parseInt(String(limit), 10) || 10);
  }

  @Get(':id')
  getPublic(@Param('id', ObjectIdPipe) id: string) {
    return this.usersService.findPublicProfile(id);
  }

  @Patch('me')
  updateMe(@GetUser() user, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user._id, dto);
  }

  // Expose daily usage and plan to the client
  @Get('me/usage')
  getUsage(@GetUser() user) {
    const sub = (user.subscription ?? {}) as any;
    const usage = (user.usageDaily ?? {}) as any;
    const today = new Date().toISOString().slice(0, 10);
    const dateISO = usage?.dateISO === today ? usage.dateISO : today;
    const sessionsUsed = usage?.dateISO === today ? Number(usage.sessionsUsed ?? 0) : 0;
    const questionsUsed = usage?.dateISO === today ? Number(usage.questionsUsed ?? 0) : 0;
    const sessionsLimit = 2;
    const questionsPerSessionLimit = 3;
    const isPremium = (() => {
      if ((user.role as any) === 'admin') return true;
      if (sub?.plan === 'premium' && sub?.status === 'active') {
        if (!sub?.endDate) return true;
        return new Date(sub.endDate).getTime() > Date.now();
      }
      if (sub?.status === 'active' && sub?.endDate) {
        return new Date(sub.endDate).getTime() > Date.now();
      }
      return false;
    })();

    return {
      plan: isPremium ? 'premium' : (sub?.plan ?? 'free'),
      isPremium,
      dateISO,
      sessionsUsed,
      sessionsLimit,
      questionsUsed,
      questionsPerSessionLimit,
    };
  }

  // Set subscription for testing; restrict to admins
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch('me/subscription')
  setSubscription(@GetUser() user, @Body('months') months: number = 1) {
    return this.usersService.setSubscription(user._id, new Date(), months);
  }

  @Post('me/favorites/:questionId')
  addFavorite(
    @GetUser() user,
    @Param('questionId', ObjectIdPipe) questionId: string,
  ) {
    return this.usersService.addFavoriteQuestion(user._id, questionId);
  }

  @Delete('me/favorites/:questionId')
  removeFavorite(
    @GetUser() user,
    @Param('questionId', ObjectIdPipe) questionId: string,
  ) {
    return this.usersService.removeFavoriteQuestion(user._id, questionId);
  }
}
