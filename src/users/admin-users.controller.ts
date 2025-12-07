import { Controller, Get, Patch, Query, Param, Body, UseGuards, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  async search(@Query('query') query: string, @Query('limit') limit = '20') {
    return this.usersService.searchUsers(query, parseInt(String(limit), 10) || 20);
  }

  @Patch(':id/subscription')
  async setSubscription(
    @Param('id', ObjectIdPipe) id: string,
    @Body('months') months: number = 12,
  ) {
    // active une période Premium manuelle
    const updated = await this.usersService.setSubscription(id, new Date(), months || 12);
    if (!updated) {
      return { id, isPremium: false, subscription: null };
    }
    return { id: updated._id, isPremium: true, subscription: updated.subscription };
  }

  @Delete(':id/subscription')
  async clearSubscription(@Param('id', ObjectIdPipe) id: string) {
    const updated = await this.usersService.clearSubscription(id);
    return { id: updated._id, isPremium: false, subscription: updated.subscription };
  }
}
