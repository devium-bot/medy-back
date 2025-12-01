import { IsMongoId } from 'class-validator';

export class CreateCoopSessionDto {
  @IsMongoId({ message: 'Identifiant ami invalide' })
  friendId: string;
}
