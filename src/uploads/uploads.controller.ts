import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { memoryStorage } from 'multer';
import { GetUser } from '../auth/get-user.decorator';
import type { Multer } from 'multer';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          return cb(new BadRequestException('Seules les images sont autorisées.'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(@UploadedFile() file: Multer.File, @GetUser() user) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    const res = await this.uploadsService.uploadAvatar(file, user?._id);
    return { url: res.secure_url };
  }

  @Post('report')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          return cb(new BadRequestException('Seules les images sont autorisées.'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadReport(@UploadedFile() file: Multer.File, @GetUser() user) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    const res = await this.uploadsService.uploadReport(file, user?._id);
    return { url: res.secure_url };
  }
}
