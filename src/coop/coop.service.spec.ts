import { BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { CoopService } from './coop.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

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
    const notifications = { emit: jest.fn() } as unknown as NotificationsService;
    const realtime = { emitToSession: jest.fn() } as unknown as RealtimeService;
    const questionModel = mockModel({});

    const service = new CoopService(
      coopModel,
      friendshipModel,
      notifications,
      questionModel,
      realtime,
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
    const service = new CoopService(
      coopModel,
      mockModel({}),
      ({ emit: jest.fn() } as unknown) as NotificationsService,
      questionModel,
      ({ emitToSession: jest.fn() } as unknown) as RealtimeService,
    );

    const res = await service.launchSession(new Types.ObjectId().toHexString(), idA.toHexString());
    expect(res?.questions?.length).toBe(2);
    expect(readySession.status).toBe('in_progress');
  });

  it('setReady moves to ready when both true', async () => {
    const sess = makeSessionDoc();
    const coopModel = mockModel({ findById: jest.fn().mockResolvedValue(sess) });
    const service = new CoopService(
      coopModel,
      mockModel({}),
      ({ emit: jest.fn() } as unknown) as NotificationsService,
      mockModel({}),
      ({ emitToSession: jest.fn() } as unknown) as RealtimeService,
    );
    const updated = await service.setReady(sess._id.toHexString(), idB.toHexString(), true);
    expect(updated.status).toBe('ready');
  });
});

