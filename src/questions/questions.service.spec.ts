import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { QuestionsService } from './questions.service';
import { Question } from './schemas/question.schema';
import { Unite } from '../categorie/unites/schema/unite.schema';
import { Module as ModuleEntity } from '../categorie/modules/schema/module.schema';
import { Cours } from '../categorie/cours/schema/cours.schema';

describe('QuestionsService', () => {
  let service: QuestionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        { provide: getModelToken(Question.name), useValue: {} },
        { provide: getModelToken(Unite.name), useValue: {} },
        { provide: getModelToken(ModuleEntity.name), useValue: {} },
        { provide: getModelToken(Cours.name), useValue: {} },
      ],
    }).compile();

    service = module.get<QuestionsService>(QuestionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
