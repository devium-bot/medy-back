import { Controller, Get, Patch, Param, UseGuards, Query, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@GetUser() user: any, @Query('status') status?: 'unread' | 'all') {
    return this.notificationsService.list(String(user._id), status === 'unread');
  }

  @Patch(':id/read')
  async markRead(@GetUser() user: any, @Param('id') id: string) {
    return this.notificationsService.markRead(String(user._id), id);
  }

  @Post('read-all')
  async markAll(@GetUser() user: any) {
    return this.notificationsService.markAllRead(String(user._id));
  }
}

