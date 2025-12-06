import { BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { CoopService } from './coop.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ConflictException } from '@nestjs/common';

function mockModel<T extends object>(impl: Partial<Record<keyof Model<T>, any>> = {}): any {
  return { ...impl } as any;
}

describe('CoopService (unit)', () => {
  const idA = new Types.ObjectId();
  const idB = new Types.ObjectId();

  const makeSessionDoc = (overrides: any = {}) => {
    const base: any = {
      _id: new Types.ObjectId(),
      participants: [idA, idB],
      initiator: idA,
      readiness: new Map<string, boolean>([
        [idA.toHexString(), true],
        [idB.toHexString(), false],
      ]),
      status: 'pending',
      filters: {},
      save: jest.fn().mockResolvedValue(true),
    };
    return Object.assign(base, overrides);
  };

  it('launchSession refuses when not all ready', async () => {
    const coopModel = mockModel({
      findById: jest.fn().mockResolvedValue(makeSessionDoc()),
    });
    const friendshipModel = mockModel({});
    const notifications = { emit: jest.fn(), sendPushToUser: jest.fn() } as unknown as NotificationsService;
    const realtime = { emitToSession: jest.fn(), emitSessionEvent: jest.fn(), isUserOnline: jest.fn().mockReturnValue(false) } as unknown as RealtimeService;
    const questionModel = mockModel({});
    const usersService = { findById: jest.fn() } as any;

    const service = new CoopService(
      coopModel,
      friendshipModel,
      notifications,
      questionModel,
      mockModel({ insertMany: jest.fn() }),
      realtime,
      usersService,
    );

    await expect(service.launchSession(new Types.ObjectId().toHexString(), idA.toHexString())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('launchSession returns questions when both ready', async () => {
    const readySession = makeSessionDoc({
      readiness: new Map<string, boolean>([
        [idA.toHexString(), true],
        [idB.toHexString(), true],
      ]),
      save: jest.fn().mockResolvedValue(true),
    });
    const coopModel = mockModel({ findById: jest.fn().mockResolvedValue(readySession) });
    const questionIds = [new Types.ObjectId(), new Types.ObjectId()];
    const questionModel = mockModel({
      aggregate: jest.fn().mockResolvedValue(questionIds.map((_id) => ({ _id }))),
      find: jest.fn().mockReturnValue({
        populate: () => ({ populate: () => ({ populate: () => ({ lean: () => Promise.resolve([{ _id: questionIds[0] }, { _id: questionIds[1] }]) }) }) }),
      }),
    });
    const usersService = { findById: jest.fn() } as any;
    const service = new CoopService(
      coopModel,
      mockModel({}),
      ({ emit: jest.fn(), sendPushToUser: jest.fn() } as unknown) as NotificationsService,
      questionModel,
      mockModel({ insertMany: jest.fn() }),
      ({ emitToSession: jest.fn(), emitSessionEvent: jest.fn(), isUserOnline: jest.fn().mockReturnValue(false) } as unknown) as RealtimeService,
      usersService,
    );

    const res = await service.launchSession(new Types.ObjectId().toHexString(), idA.toHexString());
    expect(res?.questions?.length).toBe(2);
    expect(readySession.status).toBe('in_progress');
  });

  it('setReady moves to ready when both true', async () => {
    const sess = makeSessionDoc();
    const coopModel = mockModel({ findById: jest.fn().mockResolvedValue(sess) });
    const usersService = { findById: jest.fn() } as any;
    const service = new CoopService(
      coopModel,
      mockModel({}),
      ({ emit: jest.fn(), sendPushToUser: jest.fn() } as unknown) as NotificationsService,
      mockModel({}),
      mockModel({ insertMany: jest.fn() }),
      ({ emitToSession: jest.fn(), emitSessionEvent: jest.fn(), isUserOnline: jest.fn().mockReturnValue(false) } as unknown) as RealtimeService,
      usersService,
    );
    const updated = await service.setReady(sess._id.toHexString(), idB.toHexString(), true);
    expect(updated.status).toBe('ready');
  });

  it('submitResult prevents double submit and sets winner', async () => {
    const questions = [
      {
        _id: new Types.ObjectId(),
        options: ['a', 'b', 'c', 'd'],
        correctAnswer: [1],
      },
      {
        _id: new Types.ObjectId(),
        options: ['x', 'y', 'z'],
        correctAnswer: [0, 2],
      },
    ];
    const sess = makeSessionDoc({
      status: 'in_progress',
      results: new Map<string, any>(),
      questionIds: questions.map((q) => q._id),
      correctionMode: 'standard',
      submittedBy: [],
      startedAt: new Date(Date.now() - 1000),
    });
    let submitCalled = 0;
    const coopModel = mockModel({
      findOneAndUpdate: jest.fn().mockImplementation((_filter, _update, _opts) => {
        submitCalled += 1;
        return Promise.resolve(submitCalled <= 2 ? sess : null);
      }),
    });
    const questionModel = mockModel({
      find: jest.fn().mockReturnValue({
        lean: () => Promise.resolve(questions),
      }),
    });
    const service = new CoopService(
      coopModel,
      mockModel({}),
      ({ emit: jest.fn(), sendPushToUser: jest.fn() } as unknown) as NotificationsService,
      questionModel,
      mockModel({ insertMany: jest.fn().mockResolvedValue([]) }),
      ({ emitToSession: jest.fn(), emitSessionEvent: jest.fn(), isUserOnline: jest.fn().mockReturnValue(false) } as unknown) as RealtimeService,
      { findById: jest.fn() } as any,
    );

    const first = await service.submitResult(sess._id.toHexString(), idA.toHexString(), {
      answers: [
        { questionId: String(questions[0]._id), selectedOptionIndexes: [1] }, // correct
        { questionId: String(questions[1]._id), selectedOptionIndexes: [0, 2] }, // exact match
      ],
      durationMs: 1000,
    });
    expect(first.results[idA.toHexString()].score).toBeCloseTo(2);
    expect(first.results[idA.toHexString()].scorePct).toBeCloseTo(100);

    // second participant submits avec même score mais plus lent (serverDuration fait foi)
    const res = await service.submitResult(sess._id.toHexString(), idB.toHexString(), {
      answers: [
        { questionId: String(questions[0]._id), selectedOptionIndexes: [1] },
        { questionId: String(questions[1]._id), selectedOptionIndexes: [0, 2] },
      ],
      durationMs: 900,
    });
    expect(res.winner).toBe(idA.toHexString());

    // double submit should error
    await expect(
      service.submitResult(sess._id.toHexString(), idA.toHexString(), {
        answers: [
          { questionId: String(questions[0]._id), selectedOptionIndexes: [1] },
          { questionId: String(questions[1]._id), selectedOptionIndexes: [0, 2] },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
