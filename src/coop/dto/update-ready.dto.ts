import { IsBoolean } from 'class-validator';

export class UpdateReadyDto {
  @IsBoolean()
  ready: boolean;
}
