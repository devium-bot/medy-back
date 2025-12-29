import 'dotenv/config';
import { connect, disconnect, model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { User, UserSchema } from '../src/users/schemas/user.schema';

type SeedUser = {
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  firstName: string;
  lastName: string;
  studyYear: number;
  speciality: 'medecine' | 'pharmacie' | 'dentaire';
  premium?: boolean;
};

const USERS: SeedUser[] = [
  {
    username: 'youssou',
    email: 'youss@test.com',
    password: 'Test123!',
    role: 'user',
    firstName: 'youssou',
    lastName: 'ounzar',
    studyYear: 1,
    speciality: 'medecine',
    premium: true,
  },
  {
    username: 'admin-med',
    email: 'med@admin.app',
    password: 'Admin123!',
    role: 'admin',
    firstName: 'med',
    lastName: 'admin',
    studyYear: 1,
    speciality: 'medecine',
  },
  {
    username: 'admin-faress',
    email: 'faress@admin.app',
    password: 'Admin123!',
    role: 'admin',
    firstName: 'faress',
    lastName: 'admin',
    studyYear: 1,
    speciality: 'medecine',
  },
  {
    username: 'admin-shou',
    email: 'shou@admin.com',
    password: 'Admin123!',
    role: 'admin',
    firstName: 'shou',
    lastName: 'admin',
    studyYear: 1,
    speciality: 'medecine',
  },
];

const UserModel = model(User.name, UserSchema);

const addMonths = (base: Date, months: number) => {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
};

async function main(): Promise<void> {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI manquant dans les variables d’environnement');

  await connect(mongoUri);
  const session = await UserModel.startSession();

  try {
    await session.withTransaction(async () => {
      await UserModel.deleteMany({}, { session });

      const now = new Date();
      const docs = await Promise.all(
        USERS.map(async (user) => {
          const passwordHash = await bcrypt.hash(user.password, 10);
          const subscription = user.premium
            ? {
                status: 'active',
                plan: 'premium',
                provider: 'manual',
                paymentDate: now,
                startDate: now,
                endDate: addMonths(now, 12),
              }
            : {
                status: 'active',
                plan: 'free',
                provider: 'manual',
                startDate: now,
                endDate: now,
              };

          return {
            username: user.username,
            email: user.email.toLowerCase(),
            passwordHash,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
            studyYear: user.studyYear,
            speciality: user.speciality,
            authProvider: ['email'],
            isVerified: true,
            verifiedAt: now,
            subscription,
            favorites: {},
            stats: {},
            badges: [],
            usageDaily: {},
            pushTokens: [],
            createdAt: now,
            updatedAt: now,
          };
        }),
      );

      await UserModel.insertMany(docs, { session });
      // eslint-disable-next-line no-console
      console.log(`Users reset: ${docs.length} comptes insérés.`);
    });
  } finally {
    await session.endSession();
    await disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Echec du reset users:', err);
  process.exitCode = 1;
});
