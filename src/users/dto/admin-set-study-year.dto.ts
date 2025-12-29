import { IsInt, Max, Min } from 'class-validator';

export class AdminSetStudyYearDto {
  @IsInt()
  @Min(1)
  @Max(7)
  studyYear: number;
}

