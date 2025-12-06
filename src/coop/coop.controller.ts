import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CoopService } from './coop.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DailyUsageGuard } from '../common/guards/daily-usage.guard';
import { GetUser } from '../auth/get-user.decorator';
import { CreateCoopSessionDto } from './dto/create-coop-session.dto';
import { UpdateReadyDto } from './dto/update-ready.dto';
import { UpdateFiltersDto } from './dto/update-filters.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';

@UseGuards(JwtAuthGuard)
@Controller('coop')
export class CoopController {
  constructor(private readonly coopService: CoopService) {}

  @UseGuards(DailyUsageGuard)
  @Post('session')
  create(@GetUser() user: any, @Body() dto: CreateCoopSessionDto) {
    return this.coopService.createSession(String(user._id), dto.friendId);
  }

  @Get('session/:id')
  getSession(
    @GetUser() user: any,
    @Param('id', ObjectIdPipe) sessionId: string,
  ) {
    return this.coopService.getSession(sessionId, String(user._id));
  }

  @Patch('session/:id/ready')
  setReady(
    @GetUser() user: any,
    @Param('id', ObjectIdPipe) sessionId: string,
    @Body() dto: UpdateReadyDto,
  ) {
    return this.coopService.setReady(sessionId, String(user._id), dto.ready);
  }

  @Patch('session/:id/filters')
  setFilters(
    @GetUser() user: any,
    @Param('id', ObjectIdPipe) sessionId: string,
    @Body() dto: UpdateFiltersDto,
  ) {
    return this.coopService.setFilters(sessionId, String(user._id), dto);
  }

  @Post('session/:id/launch')
  launch(
    @GetUser() user: any,
    @Param('id', ObjectIdPipe) sessionId: string,
  ) {
    return this.coopService.launchSession(sessionId, String(user._id));
  }

  @Patch('session/:id/result')
  submitResult(
    @GetUser() user: any,
    @Param('id', ObjectIdPipe) sessionId: string,
    @Body() body: SubmitAnswersDto,
  ) {
    return this.coopService.submitResult(sessionId, String(user._id), body);
  }

  @Delete('session/:id')
  cancel(
    @GetUser() user: any,
    @Param('id', ObjectIdPipe) sessionId: string,
  ) {
    return this.coopService.cancelSession(sessionId, String(user._id));
  }
}
