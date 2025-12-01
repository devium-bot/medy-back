import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { Question } from './schemas/question.schema';
import { Unite } from '../categorie/unites/schema/unite.schema';
import { Module as ModuleEntity } from '../categorie/modules/schema/module.schema';
import { Cours } from '../categorie/cours/schema/cours.schema';
import { DailyUsageGuard } from '../common/guards/daily-usage.guard';
import { User } from '../users/schemas/user.schema';

describe('QuestionsController', () => {
  let controller: QuestionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionsController],
      providers: [
        QuestionsService,
        { provide: getModelToken(Question.name), useValue: {} },
        { provide: getModelToken(Unite.name), useValue: {} },
        { provide: getModelToken(ModuleEntity.name), useValue: {} },
        { provide: getModelToken(Cours.name), useValue: {} },
        { provide: getModelToken(User.name), useValue: { findById: jest.fn() } },
        { provide: DailyUsageGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get<QuestionsController>(QuestionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
