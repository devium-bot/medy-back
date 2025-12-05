import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReportStatus } from '../schemas/report.schema';

export class UpdateReportDto {
  @IsOptional()
  @IsEnum(['open', 'in_progress', 'closed'])
  status?: ReportStatus;

  @IsOptional()
  @IsString()
  internalNote?: string;
}
