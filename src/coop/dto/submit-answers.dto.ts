import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested, IsNumber, Min } from 'class-validator';

class AnswerDto {
  @IsString()
  questionId!: string;

  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  @ArrayMaxSize(20)
  selectedOptionIndexes!: number[];
}

export class SubmitAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  @ArrayMinSize(1)
  answers!: AnswerDto[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  durationMs?: number;
}
