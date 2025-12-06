import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FiltersDto {
  @IsArray()
  @IsOptional()
  @Type(() => String)
  unitIds?: string[];

  @IsArray()
  @IsOptional()
  @Type(() => String)
  moduleIds?: string[];

  @IsArray()
  @IsOptional()
  @Type(() => String)
  courseIds?: string[];

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  studyYear?: number | null;

  @IsString()
  @IsOptional()
  speciality?: string | null;

  @IsString()
  @IsOptional()
  university?: string | null;
}

export class UpdateFiltersDto {
  @ValidateNested()
  @Type(() => FiltersDto)
  @IsOptional()
  filters?: FiltersDto;

  @IsEnum(['positive', 'standard', 'binary'] as any)
  @IsOptional()
  correctionMode?: 'positive' | 'standard' | 'binary';

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  count?: number;

  @IsOptional()
  @IsEnum(['facile', 'moyen', 'difficile'] as any)
  level?: 'facile' | 'moyen' | 'difficile';
}
