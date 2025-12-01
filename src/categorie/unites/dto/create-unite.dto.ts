import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { SPECIALITIES } from '../../../common/specialities';

export class CreateUniteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nom: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @IsIn(SPECIALITIES)
  speciality: string;

  @IsInt()
  @Min(1)
  @Max(7)
  studyYear: number;
}
