import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { ConfirmIapDto } from './dto/confirm-iap.dto';
import { IapService } from './iap.service';

@Controller('iap')
export class IapController {
  constructor(private readonly iapService: IapService) {}

  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  async confirm(@GetUser() user, @Body() body: ConfirmIapDto) {
    return this.iapService.confirmPurchase(user._id, body);
  }
}
