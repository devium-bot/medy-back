import { IsIn, IsInt, IsMongoId, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { SPECIALITIES } from '../../../common/specialities';

export class CreateModuleDto {
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

  @IsMongoId()
  @IsNotEmpty()
  unite: string;
}
