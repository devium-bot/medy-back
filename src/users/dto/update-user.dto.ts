import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { SPECIALITIES, Speciality } from '../../common/specialities';
import { IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  studyYear?: number;

  @IsOptional()
  @IsIn(SPECIALITIES)
  speciality?: Speciality;

  @IsOptional()
  @IsUrl({ require_protocol: false }, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  badges?: string[];

  @IsOptional()
  @IsBoolean()
  showPublicStats?: boolean;

  @IsOptional()
  @IsBoolean()
  showPublicAchievements?: boolean;
}
