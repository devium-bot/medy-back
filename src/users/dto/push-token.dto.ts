import { IsIn, IsOptional, IsString } from 'class-validator';

export class PushTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsIn(['ios', 'android', 'web'] as const)
  platform?: 'ios' | 'android' | 'web';
}

export class DeletePushTokenDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
