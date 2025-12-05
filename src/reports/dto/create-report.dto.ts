import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Types } from 'mongoose';
import { ReportType } from '../schemas/report.schema';

export class CreateReportDto {
  @IsEnum(['question', 'feature', 'other'])
  type: ReportType;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  questionId?: string;

  @IsOptional()
  @IsString()
  screen?: string;

  @IsOptional()
  context?: Record<string, any>;

  @IsOptional()
  @IsString()
  screenshotUrl?: string;
}
