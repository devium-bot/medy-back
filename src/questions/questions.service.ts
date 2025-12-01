import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question } from './schemas/question.schema';
import { CreateQuestionDto } from './dto/create-question.dto';
import { Unite } from '../categorie/unites/schema/unite.schema';
import { Module as ModuleEntity } from '../categorie/modules/schema/module.schema';
import { Cours } from '../categorie/cours/schema/cours.schema';
import { SPECIALITIES } from '../common/specialities';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<Question>,
    @InjectModel(Unite.name)
    private readonly uniteModel: Model<Unite>,
    @InjectModel(ModuleEntity.name)
    private readonly moduleModel: Model<ModuleEntity>,
    @InjectModel(Cours.name)
    private readonly coursModel: Model<Cours>,
  ) {}

  async create(data: CreateQuestionDto) {
    const maxIndex = data.options.length - 1;
    const normalizedCorrect = [...new Set(data.correctAnswer)].sort(
      (a, b) => a - b,
    );

    if (normalizedCorrect.some((index) => index > maxIndex)) {
      throw new BadRequestException('Indice de réponse correcte hors limites.');
    }

    const [unite, moduleDoc, cours] = await Promise.all([
      this.uniteModel.findById(data.unite).select('_id').lean().exec(),
      this.moduleModel.findById(data.module).select('unite').lean().exec(),
      this.coursModel.findById(data.cours).select('module').lean().exec(),
    ]);

    if (!unite) {
      throw new NotFoundException('Unité introuvable');
    }
    if (!moduleDoc) {
      throw new NotFoundException('Module introuvable');
    }
    if (!cours) {
      throw new NotFoundException('Cours introuvable');
    }

    if (moduleDoc.unite?.toString() !== data.unite) {
      throw new BadRequestException('Le module est associé à une autre unité.');
    }

    if (cours.module?.toString() !== data.module) {
      throw new BadRequestException('Le cours est associé à un autre module.');
    }

    const speciality =
      data.speciality.toLowerCase() as (typeof SPECIALITIES)[number];
    const question = await this.questionModel.create({
      ...data,
      speciality,
      university: data.university?.trim() ?? undefined,
      correctAnswer: normalizedCorrect,
    });

    return this.findById(question.id);
  }

  async findAll(
    filters: {
      year?: number;
      qcmYear?: number;
      unite?: string[];
      module?: string[];
      cours?: string[];
      speciality?: string;
      university?: string;
    } = {},
  ) {
    const query: any = {};

    if (typeof filters.year === 'number' && !Number.isNaN(filters.year)) {
      query.year = filters.year;
    }
    if (typeof filters.qcmYear === 'number' && !Number.isNaN(filters.qcmYear)) {
      query.qcmYear = filters.qcmYear;
    }

    if (filters.unite?.length) {
      query.unite = {
        $in: filters.unite
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      };
    }

    if (filters.module?.length) {
      query.module = {
        $in: filters.module
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      };
    }

    if (filters.cours?.length) {
      query.cours = {
        $in: filters.cours
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      };
    }

    const speciality =
      filters.speciality?.toLowerCase?.() ?? filters.speciality;
    if (speciality && SPECIALITIES.includes(speciality as any)) {
      query.speciality = speciality;
    }

    if (filters.university) {
      query.university = filters.university.trim();
    }

    return this.questionModel
      .find(query)
      .populate('unite', 'nom')
      .populate('module', 'nom')
      .populate('cours', 'nom')
      .select('-__v')
      .lean()
      .exec();
  }

  async getAvailableUniversities(filters: {
    year?: number;
    qcmYear?: number;
    speciality?: string;
    studyYear?: number;
  } = {}) {
    const query: any = {};

    if (typeof filters.year === 'number' && !Number.isNaN(filters.year)) {
      query.year = filters.year;
    }
    if (typeof filters.qcmYear === 'number' && !Number.isNaN(filters.qcmYear)) {
      query.qcmYear = filters.qcmYear;
    }

    const speciality = filters.speciality?.toLowerCase?.() ?? filters.speciality;
    if (speciality && SPECIALITIES.includes(speciality as any)) {
      query.speciality = speciality;
    }

    if (typeof filters.studyYear === 'number' && !Number.isNaN(filters.studyYear)) {
      query.year = filters.studyYear;
    }

    const values = await this.questionModel.distinct('university', query).exec();
    return (values ?? [])
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
      .map((v: string) => v.trim())
      .sort((a: string, b: string) => a.localeCompare(b));
  }

  async getAvailableQcmYears(filters: {
    speciality?: string;
    studyYear?: number;
    university?: string;
  } = {}) {
    const query: any = {};

    const speciality = filters.speciality?.toLowerCase?.() ?? filters.speciality;
    if (speciality && SPECIALITIES.includes(speciality as any)) {
      query.speciality = speciality;
    }
    if (typeof filters.studyYear === 'number' && !Number.isNaN(filters.studyYear)) {
      query.year = filters.studyYear;
    }
    if (filters.university) {
      query.university = filters.university.trim();
    }

    const values = await this.questionModel.distinct('qcmYear', query).exec();
    return (values ?? [])
      .map((v: any) => (typeof v === 'number' ? v : Number(v)))
      .filter((n) => Number.isFinite(n))
      .sort((a: number, b: number) => b - a);
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Identifiant invalide');
    }

    const question = await this.questionModel
      .findById(id)
      .populate('unite', 'nom')
      .populate('module', 'nom')
      .populate('cours', 'nom')
      .select('-__v')
      .lean()
      .exec();

    if (!question) {
      throw new NotFoundException('Question introuvable');
    }

    return question;
  }

  async deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Identifiant invalide');
    }

    const deleted = await this.questionModel
      .findByIdAndDelete(id)
      .populate('unite', 'nom')
      .populate('module', 'nom')
      .populate('cours', 'nom')
      .select('-__v')
      .lean()
      .exec();

    if (!deleted) {
      throw new NotFoundException('Question introuvable');
    }

    return deleted;
  }

  async getRandom(
    count: number,
    filters: {
      unite?: string[];
      module?: string[];
      cours?: string[];
      speciality?: string;
      year?: number;
      university?: string;
    } = {},
  ) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new BadRequestException(
        'Le nombre de questions doit être un entier positif.',
      );
    }
    const query: any = {};

    if (filters.unite?.length) {
      query.unite = {
        $in: filters.unite
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      };
    }

    if (filters.module?.length) {
      query.module = {
        $in: filters.module
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      };
    }

    if (filters.cours?.length) {
      query.cours = {
        $in: filters.cours
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      };
    }

    const speciality =
      filters.speciality?.toLowerCase?.() ?? filters.speciality;
    if (speciality && SPECIALITIES.includes(speciality as any)) {
      query.speciality = speciality;
    }

    if (typeof filters.year === 'number' && !Number.isNaN(filters.year)) {
      query.year = filters.year;
    }

    if (filters.university) {
      query.university = filters.university.trim();
    }

    const randomDocs = await this.questionModel.aggregate([
      { $match: query },
      { $sample: { size: count } },
    ]);

    return this.questionModel.populate(randomDocs, [
      { path: 'unite', select: 'nom' },
      { path: 'module', select: 'nom' },
      { path: 'cours', select: 'nom' },
    ]);
  }
}
