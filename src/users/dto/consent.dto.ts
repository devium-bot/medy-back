import { IsOptional, IsString } from 'class-validator';

export class ConsentDto {
  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
