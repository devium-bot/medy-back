import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ObjectIdPipe } from '../common/pipes/object-id.pipe';
import { DailyUsageGuard } from '../common/guards/daily-usage.guard';

@Controller('questions')
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateQuestionDto) {
    return this.questionsService.create(dto);
  }

  @Get()
  async findAll(
    @Query('year') year?: string,
    @Query('studyYear') studyYear?: string,
    @Query('qcmYear') qcmYear?: string,
    @Query('unite') unite?: string,
    @Query('module') module?: string,
    @Query('cours') cours?: string,
    @Query('speciality') speciality?: string,
    @Query('university') university?: string,
  ) {
    const filters: any = {};
    const resolvedYear = studyYear ?? year;
    if (resolvedYear !== undefined) {
      const parsed = Number(resolvedYear);
      if (!Number.isNaN(parsed)) filters.year = parsed;
    }
    if (qcmYear !== undefined) {
      const parsedQcmYear = Number(qcmYear);
      if (!Number.isNaN(parsedQcmYear)) filters.qcmYear = parsedQcmYear;
    }
    if (unite) filters.unite = unite.split(',');
    if (module) filters.module = module.split(',');
    if (cours) filters.cours = cours.split(',');
    if (speciality) filters.speciality = speciality.toLowerCase();
    if (university) filters.university = university.trim();

    return this.questionsService.findAll(filters);
  }

  @Get('universities')
  async getUniversities(
    @Query('studyYear') studyYear?: string,
    @Query('speciality') speciality?: string,
    @Query('qcmYear') qcmYear?: string,
  ) {
    const filters: any = {};
    if (studyYear !== undefined) {
      const parsed = Number(studyYear);
      if (!Number.isNaN(parsed)) filters.studyYear = parsed;
    }
    if (qcmYear !== undefined) {
      const parsedQcmYear = Number(qcmYear);
      if (!Number.isNaN(parsedQcmYear)) filters.qcmYear = parsedQcmYear;
    }
    if (speciality) filters.speciality = String(speciality).toLowerCase();
    return this.questionsService.getAvailableUniversities(filters);
  }

  @Get('years')
  async getYears(
    @Query('studyYear') studyYear?: string,
    @Query('speciality') speciality?: string,
    @Query('university') university?: string,
  ) {
    const filters: any = {};
    if (studyYear !== undefined) {
      const parsed = Number(studyYear);
      if (!Number.isNaN(parsed)) filters.studyYear = parsed;
    }
    if (speciality) filters.speciality = String(speciality).toLowerCase();
    if (university) filters.university = String(university).trim();
    return this.questionsService.getAvailableQcmYears(filters);
  }

  @UseGuards(JwtAuthGuard, DailyUsageGuard)
  @Get('random/:count')
  async getRandom(
    @Param('count') count: number,
    @Query('unite') unite?: string,
    @Query('module') module?: string,
    @Query('cours') cours?: string,
    @Query('speciality') speciality?: string,
    @Query('year') year?: string,
    @Query('studyYear') studyYear?: string,
    @Query('university') university?: string,
  ) {
    const filters: any = {};
    if (unite) filters.unite = unite.split(',');
    if (module) filters.module = module.split(',');
    if (cours) filters.cours = cours.split(',');
    if (speciality) filters.speciality = speciality.toLowerCase();

    const resolvedYear = studyYear ?? year;
    if (resolvedYear !== undefined) {
      const parsed = Number(resolvedYear);
      if (!Number.isNaN(parsed)) filters.year = parsed;
    }
    if (university) filters.university = university.trim();

    return this.questionsService.getRandom(Number(count), filters);
  }

  // Solo start endpoint: counts as a session for free users and returns up to 3 questions
  @UseGuards(JwtAuthGuard, DailyUsageGuard)
  @Post('solo/start')
  async soloStart(
    @Body('count') countRaw?: number,
    @Body('unite') unite?: string,
    @Body('module') module?: string,
    @Body('cours') cours?: string,
    @Body('speciality') speciality?: string,
    @Body('year') year?: string,
    @Body('studyYear') studyYear?: string,
    @Body('university') university?: string,
  ) {
    const filters: any = {};
    const resolvedYear = studyYear ?? year;
    if (resolvedYear !== undefined) {
      const parsed = Number(resolvedYear);
      if (!Number.isNaN(parsed)) filters.year = parsed;
    }
    if (unite) filters.unite = String(unite).split(',');
    if (module) filters.module = String(module).split(',');
    if (cours) filters.cours = String(cours).split(',');
    if (speciality) filters.speciality = String(speciality).toLowerCase();
    if (university) filters.university = String(university).trim();

    const count = Math.max(1, Number(countRaw) || 3);
    return this.questionsService.getRandom(count, filters);
  }

  @Get(':id')
  async findById(@Param('id', ObjectIdPipe) id: string) {
    return this.questionsService.findById(id);
  }

  // Route IA supprimée

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async deleteById(@Param('id', ObjectIdPipe) id: string) {
    return this.questionsService.deleteById(id);
  }
}
