import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { Report, ReportDocument } from './schemas/report.schema';

@Injectable()
export class ReportsService {
  constructor(@InjectModel(Report.name) private reportModel: Model<ReportDocument>) {}

  async create(userId: string, dto: CreateReportDto) {
    const toCreate: any = {
      userId: new Types.ObjectId(userId),
      type: dto.type,
      message: dto.message,
      status: 'open',
    };
    if (dto.questionId && Types.ObjectId.isValid(dto.questionId)) {
      toCreate.questionId = new Types.ObjectId(dto.questionId);
    }
    if (dto.screen) toCreate.screen = dto.screen;
    if (dto.context) toCreate.context = dto.context;
    if (dto.screenshotUrl) toCreate.screenshotUrl = dto.screenshotUrl;

    const created = await this.reportModel.create(toCreate);
    return created;
  }

  async findAll(filters: { status?: string; type?: string; page?: number; limit?: number }) {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.reportModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reportModel.countDocuments(query),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const report = await this.reportModel.findById(id).lean();
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async update(id: string, dto: UpdateReportDto) {
    const updated = await this.reportModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Report not found');
    return updated;
  }
}
