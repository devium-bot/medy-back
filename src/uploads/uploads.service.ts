import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { File } from 'multer';
import { UsersService } from '../users/users.service';

@Injectable()
export class UploadsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const url = this.configService.get<string>('CLOUDINARY_URL');
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (url) {
      cloudinary.config({ cloudinary_url: url });
    } else if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    } else {
      throw new BadRequestException('Cloudinary est mal configuré (CLOUDINARY_URL ou trio CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET requis).');
    }
  }

  async uploadAvatar(file: File, userId?: string) {
    const { secure_url } = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'medy/avatars',
          resource_type: 'image',
          public_id: userId ? `avatar_${userId}` : undefined,
          overwrite: true,
          transformation: [{ width: 512, height: 512, crop: 'limit', quality: 'auto:good' }],
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              new InternalServerErrorException(
                error?.message ?? 'Échec du transfert Cloudinary.',
              ),
            );
          }
          resolve({ secure_url: result.secure_url });
        },
      );

      uploadStream.end(file.buffer);
    });

    if (userId) {
      // Persist the avatar on the user profile so it stays saved after upload
      await this.usersService.updateProfile(userId, { avatarUrl: secure_url });
    }

    return { secure_url };
  }

  uploadReport(file: File, userId?: string) {
    return new Promise<{ secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'medy/reports',
          resource_type: 'image',
          public_id: userId ? `report_${userId}_${Date.now()}` : undefined,
          overwrite: false,
          transformation: [{ width: 1280, height: 1280, crop: 'limit', quality: 'auto:good' }],
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              new InternalServerErrorException(
                error?.message ?? 'Échec du transfert Cloudinary.',
              ),
            );
          }
          resolve({ secure_url: result.secure_url });
        },
      );

      uploadStream.end(file.buffer);
    });
  }
}
