import 'dotenv/config';
import { connect, disconnect, model, Types, Schema } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

import { User, UserSchema } from './src/users/schemas/user.schema';
import { Unite, UniteSchema } from './src/categorie/unites/schema/unite.schema';
import {
  Module as ModuleEntity,
  ModuleSchema,
} from './src/categorie/modules/schema/module.schema';
import {
  Cours as CoursEntity,
  CoursSchema,
} from './src/categorie/cours/schema/cours.schema';
import {
  Question as QuestionEntity,
  QuestionSchema,
} from './src/questions/schemas/question.schema';
import {
  Friendship,
  FriendshipSchema,
} from './src/friends/schemas/friendship.schema';

const UserModel = model(User.name, UserSchema);
const UniteModel = model(Unite.name, UniteSchema);
const ModuleModel = model(ModuleEntity.name, ModuleSchema);
const CoursModel = model(CoursEntity.name, CoursSchema);
const QuestionModel = model(QuestionEntity.name, QuestionSchema);
const FriendshipModel = model(Friendship.name, FriendshipSchema);

// Minimal Achievement schema for seeding purposes
const AchievementSchema = new Schema(
  {
    key: { type: String, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true }, // ex: 'mdi:trophy'
    category: { type: String },
    points: { type: Number, default: 0 },
    criteria: { type: Schema.Types.Mixed }, // JSON rules (optionnel)
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'achievements' },
);
const AchievementModel = model('Achievement', AchievementSchema);

// =========================
// CONFIG VOLUMES SEED
// =========================
const EXTRA_USERS_COUNT = 50; // nombre de users mock en plus
const BULK_UNITES_PER_SPEC = 12; // unités par spécialité pour le burst
const MODULES_PER_UNITE = 3;
const COURSES_PER_MODULE = 4;
const QUESTIONS_PER_COURSE = 8;

const SPECIALITIES: Array<'medecine' | 'pharmacie' | 'dentaire'> = [
  'medecine',
  'pharmacie',
  'dentaire',
];
const STUDY_YEARS = [1, 2, 3, 4, 5, 6, 7];

const currentYear = new Date().getFullYear();
const universities = [
  'UM1',
  'USTHB',
  'Paris-Saclay',
  'UCL',
  'Sorbonne',
  'USMBA',
  'FMPM',
  'USTO',
  'UM6SS',
  'ULB',
];
const qcmYearsPool = [
  currentYear,
  currentYear - 1,
  currentYear - 2,
  currentYear - 3,
  currentYear - 4,
];

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]) => arr[rand(0, arr.length - 1)];
const pickMany = (n: number, arr: number[]) => {
  const copy = [...arr];
  const out: number[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = rand(0, copy.length - 1);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out.sort((a, b) => a - b);
};

// ============================
// CATALOGUE RÉALISTE
// ============================
const catalog = [
  // =========================================================
  // 1. MÉDECINE – INFECTIOLOGIE (bactério / viro / parasito)
  // =========================================================
  {
    unite: {
      nom: 'Infectiologie – Bactéries Gram +',
      speciality: 'medecine' as const,
      studyYear: 3,
    },
    modules: [
      {
        nom: 'Infections à Streptocoques',
        courses: [
          {
            nom: 'Streptocoque du groupe A (SGA)',
            questions: [
              {
                questionText:
                  'Le réservoir principal du streptocoque du groupe A (SGA) est :',
                options: [
                  "Le sol",
                  "L’être humain",
                  "Les bovins",
                  "Les moustiques",
                ],
                correctAnswer: [1],
              },
              {
                questionText:
                  'Parmi les complications post-streptococciques suivantes, laquelle est à redouter après une angine à SGA non traitée ?',
                options: [
                  'Thrombose veineuse profonde',
                  'Rhumatisme articulaire aigu',
                  'Hépatite fulminante',
                  'Péritonite bactérienne spontanée',
                ],
                correctAnswer: [1],
              },
              {
                questionText:
                  "La scarlatine est classiquement due à :",
                options: [
                  "Des toxines érythrogènes produites par le SGA",
                  "Des endotoxines de S. aureus",
                  "Une réaction allergique aux β-lactamines",
                  "Une infection virale par le parvovirus B19",
                ],
                correctAnswer: [0],
              },
              {
                questionText:
                  "Le diagnostic positif d’une angine à SGA chez l’adulte repose en première intention sur :",
                options: [
                  'La radiographie du thorax',
                  'Le test de diagnostic rapide (TDR) sur prélèvement pharyngé',
                  "L’hémoculture",
                  "La sérologie ASLO",
                ],
                correctAnswer: [1],
              },
            ],
          },
          {
            nom: "Infections cutanées streptococciques",
            questions: [
              {
                questionText:
                  "L’érysipèle typique de la jambe se manifeste par :",
                options: [
                  'Un placard érythémateux bien limité, chaud et douloureux',
                  'Des bulles hémorragiques diffuses sans fièvre',
                  'Une nécrose sèche avec absence de fièvre',
                  'Une éruption vésiculeuse prurigineuse généralisée',
                ],
                correctAnswer: [0],
              },
              {
                questionText:
                  "Un facteur classique favorisant l’érysipèle de jambe est :",
                options: [
                  'Un lymphœdème chronique',
                  'Un asthme allergique',
                  'Une insuffisance coronarienne',
                  'Une hyperthyroïdie',
                ],
                correctAnswer: [0],
              },
            ],
          },
        ],
      },
      {
        nom: 'Infections à Staphylocoques',
        courses: [
          {
            nom: 'Staphylococcus aureus',
            questions: [
              {
                questionText:
                  "Parmi les infections suivantes, laquelle est typiquement liée à S. aureus ?",
                options: [
                  'Furoncle',
                  'Fièvre typhoïde',
                  'Tétanos',
                  'Tuberculose pulmonaire',
                ],
                correctAnswer: [0],
              },
              {
                questionText:
                  'Le S. aureus possède comme facteur de virulence :',
                options: [
                  'Une capsule antiphagocytaire',
                  'Une toxine botulinique',
                  'Un lipopolysaccharide (LPS) majeur',
                  'Une toxine cholérique',
                ],
                correctAnswer: [0],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    unite: {
      nom: 'Infectiologie – Virologie',
      speciality: 'medecine' as const,
      studyYear: 3,
    },
    modules: [
      {
        nom: 'VIH et infections opportunistes',
        courses: [
          {
            nom: 'VIH – Bases virologiques',
            questions: [
              {
                questionText:
                  'Le VIH est un rétrovirus qui possède comme enzyme clé :',
                options: [
                  'La transcriptase inverse',
                  'La DNA polymérase α',
                  'La neuraminidase',
                  'La β-lactamase',
                ],
                correctAnswer: [0],
              },
              {
                questionText:
                  'Le mode de transmission le plus fréquent du VIH dans le monde est :',
                options: [
                  'Transfusion sanguine',
                  'Transmission sexuelle',
                  'Transmission par piqûres de moustique',
                  'Transmission fécale-orale',
                ],
                correctAnswer: [1],
              },
            ],
          },
        ],
      },
      {
        nom: 'Hépatites virales',
        courses: [
          {
            nom: 'Hépatite B',
            questions: [
              {
                questionText:
                  'Le virus de l’hépatite B est :',
                options: [
                  'Un virus à ADN',
                  'Un virus à ARN simple brin',
                  'Un prion',
                  'Une bactérie intracellulaire',
                ],
                correctAnswer: [0],
              },
              {
                questionText:
                  'La transmission de l’hépatite B peut se faire :',
                options: [
                  'Par voie sexuelle',
                  'Par voie sanguine',
                  'De la mère à l’enfant',
                  'Toutes les réponses sont exactes',
                ],
                correctAnswer: [3],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    unite: {
      nom: 'Parasitologie – Paludisme & Toxoplasmose',
      speciality: 'medecine' as const,
      studyYear: 3,
    },
    modules: [
      {
        nom: 'Paludisme',
        courses: [
          {
            nom: 'Paludisme – Généralités',
            questions: [
              {
                questionText:
                  'Le vecteur du paludisme est :',
                options: [
                  'Le moustique Anopheles femelle',
                  'La tique Ixodes',
                  'Le pou de corps',
                  'Le phlébotome',
                ],
                correctAnswer: [0],
              },
              {
                questionText:
                  'L’accès palustre grave est le plus souvent dû à :',
                options: [
                  'Plasmodium vivax',
                  'Plasmodium malariae',
                  'Plasmodium falciparum',
                  'Plasmodium ovale',
                ],
                correctAnswer: [2],
              },
            ],
          },
        ],
      },
      {
        nom: 'Toxoplasmose',
        courses: [
          {
            nom: 'Toxoplasmose de la femme enceinte',
            questions: [
              {
                questionText:
                  'Le réservoir définitif de Toxoplasma gondii est :',
                options: [
                  'Le chien',
                  'Le chat',
                  'Le bœuf',
                  'Le porc',
                ],
                correctAnswer: [1],
              },
              {
                questionText:
                  'En cas de sérologie IgG+ IgM- chez une femme enceinte au 1er trimestre :',
                options: [
                  'On conclut à une infection récente',
                  'On conclut à une immunité ancienne',
                  'On conclut à une absence d’immunité',
                  'On conclut à une infection congénitale',
                ],
                correctAnswer: [1],
              },
            ],
          },
        ],
      },
    ],
  },

  // =========================================
  // 2. MÉDECINE – ANATOMIE / PHYSIOLOGIE
  // =========================================
  {
    unite: {
      nom: 'Anatomie – Appareil cardiovasculaire',
      speciality: 'medecine' as const,
      studyYear: 2,
    },
    modules: [
      {
        nom: 'Cœur et gros vaisseaux',
        courses: [
          {
            nom: 'Anatomie du cœur',
            questions: [
              {
                questionText:
                  'La valve située entre l’oreillette droite et le ventricule droit est :',
                options: [
                  'La valve mitrale',
                  'La valve tricuspide',
                  'La valve aortique',
                  'La valve pulmonaire',
                ],
                correctAnswer: [1],
              },
              {
                questionText:
                  'Les artères coronaires naissent :',
                options: [
                  'De l’oreillette gauche',
                  'De l’aorte ascendante',
                  'Du tronc pulmonaire',
                  'Du sinus coronaire',
                ],
                correctAnswer: [1],
              },
            ],
          },
          {
            nom: 'Grandes veines et système cave',
            questions: [
              {
                questionText:
                  'La veine cave supérieure draine principalement :',
                options: [
                  'Les membres inférieurs',
                  'Les membres supérieurs et la tête',
                  'Le foie',
                  'Les viscères abdominaux',
                ],
                correctAnswer: [1],
              },
            ],
          },
        ],
      },
      {
        nom: 'Physiologie cardiovasculaire',
        courses: [
          {
            nom: 'Physiologie de la pression artérielle',
            questions: [
              {
                questionText:
                  'La pression artérielle systolique correspond :',
                options: [
                  'À la phase de remplissage ventriculaire',
                  'À la phase d’éjection ventriculaire',
                  'À la fermeture des valves auriculo-ventriculaires',
                  'À la pression dans les veines caves',
                ],
                correctAnswer: [1],
              },
              {
                questionText:
                  'Le baroréflexe implique principalement des récepteurs situés dans :',
                options: [
                  'La moelle osseuse',
                  'Les sinus carotidiens et la crosse aortique',
                  'Les reins',
                  'Le foie',
                ],
                correctAnswer: [1],
              },
            ],
          },
        ],
      },
    ],
  },

  // ===============================
  // 3. PHARMACIE – PHARMACOLOGIE
  // ===============================
  {
    unite: {
      nom: 'Pharmacologie générale',
      speciality: 'pharmacie' as const,
      studyYear: 3,
    },
    modules: [
      {
        nom: 'Pharmacodynamie',
        courses: [
          {
            nom: 'Récepteurs et signalisation',
            questions: [
              {
                questionText:
                  'Quel type de récepteur implique une ouverture directe d’un canal ionique ?',
                options: [
                  'Récepteur couplé aux protéines G',
                  'Récepteur à activité tyrosine kinase',
                  'Récepteur ionotrope',
                  'Récepteur nucléaire',
                ],
                correctAnswer: [2],
              },
              {
                questionText:
                  'Un agoniste partiel :',
                options: [
                  'Possède une affinité nulle pour le récepteur',
                  'Ne peut jamais activer le récepteur',
                  'A une activité intrinsèque inférieure à 1',
                  'Est toujours toxique',
                ],
                correctAnswer: [2],
              },
            ],
          },
        ],
      },
      {
        nom: 'Pharmacocinétique',
        courses: [
          {
            nom: 'Biodisponibilité',
            questions: [
              {
                questionText:
                  'La biodisponibilité d’un médicament administré par voie orale est diminuée par :',
                options: [
                  'Un important effet de premier passage hépatique',
                  'Une forte liposolubilité',
                  'Une administration intraveineuse',
                  'Une formulation soluble',
                ],
                correctAnswer: [0],
              },
              {
                questionText:
                  'Le volume de distribution élevé d’un médicament traduit :',
                options: [
                  'Une forte fixation tissulaire',
                  'Une forte fixation plasmatique uniquement',
                  'Une élimination rénale très rapide',
                  'Une absence de diffusion tissulaire',
                ],
                correctAnswer: [0],
              },
            ],
          },
        ],
      },
    ],
  },

  // ==========================
  // 4. DENTAIRE – ODONTOLOGIE
  // ==========================
  {
    unite: {
      nom: 'Odontologie préventive',
      speciality: 'dentaire' as const,
      studyYear: 2,
    },
    modules: [
      {
        nom: 'Pathologie carieuse',
        courses: [
          {
            nom: 'Processus carieux',
            questions: [
              {
                questionText:
                  'La carie débute classiquement par :',
                options: [
                  'Une déminéralisation de l’émail en surface',
                  'Une nécrose pulpaire immédiate',
                  'Une fracture radiculaire',
                  'Une lyse du cément apical',
                ],
                correctAnswer: [0],
              },
              {
                questionText:
                  'Le principal facteur bactérien impliqué dans la carie est :',
                options: [
                  'Streptococcus mutans',
                  'Staphylococcus aureus',
                  'Escherichia coli',
                  'Pseudomonas aeruginosa',
                ],
                correctAnswer: [0],
              },
            ],
          },
        ],
      },
      {
        nom: 'Hygiène bucco-dentaire',
        courses: [
          {
            nom: 'Prévention et fluoration',
            questions: [
              {
                questionText:
                  'Le fluor agit principalement en :',
                options: [
                  'Durcissant le cément',
                  'Favorisant la reminéralisation de l’émail',
                  'Remplaçant le calcium dans la pulpe',
                  'Empêchant mécaniquement le brossage',
                ],
                correctAnswer: [1],
              },
            ],
          },
        ],
      },
    ],
  },

  // ============================================
  // 5. MÉDECINE – PNEUMO / CARDIO / NEURO (court)
  // ============================================
  {
    unite: {
      nom: 'Pneumologie clinique',
      speciality: 'medecine' as const,
      studyYear: 4,
    },
    modules: [
      {
        nom: 'Asthme & BPCO',
        courses: [
          {
            nom: 'Asthme – Bases',
            questions: [
              {
                questionText:
                  'L’asthme est défini comme :',
                options: [
                  'Une infection aiguë du parenchyme pulmonaire',
                  'Une maladie inflammatoire chronique des voies aériennes',
                  'Une fibrose irréversible du poumon',
                  'Une pathologie purement allergique de la peau',
                ],
                correctAnswer: [1],
              },
              {
                questionText:
                  'Le traitement de fond principal de l’asthme persistant repose sur :',
                options: [
                  'Les β2-mimétiques de courte durée d’action seuls',
                  'Les corticoïdes inhalés',
                  'Les antibiotiques à large spectre',
                  'Les anti-vitamine K',
                ],
                correctAnswer: [1],
              },
            ],
          },
        ],
      },
    ],
  },
];

// ====================
// FONCTION SEED
// ====================
async function seed() {
  const mongoUri =
    process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/QCM-med';

  try {
    await connect(mongoUri);
    console.log('📦 Connexion MongoDB réussie');

    await Promise.all([
      UserModel.deleteMany({}),
      FriendshipModel.deleteMany({}),
      QuestionModel.deleteMany({}),
      CoursModel.deleteMany({}),
      ModuleModel.deleteMany({}),
      UniteModel.deleteMany({}),
      AchievementModel.deleteMany({}),
    ]);
    console.log('🧹 Collections nettoyées');

    // Seed: Achievements catalog
    const ACHIEVEMENTS = [
      {
        key: 'first_session',
        title: 'Première session',
        description: 'Terminer une session.',
        icon: 'mdi:trophy',
        category: 'progress',
        points: 10,
        criteria: { type: 'session_count', count: 1 },
        active: true,
      },
      {
        key: 'ten_sessions',
        title: 'Assidu',
        description: 'Terminer 10 sessions.',
        icon: 'mdi:medal',
        category: 'progress',
        points: 20,
        criteria: { type: 'session_count', count: 10 },
        active: true,
      },
      {
        key: 'score_80',
        title: 'Bon niveau',
        description: 'Obtenir ≥ 80% sur une session.',
        icon: 'mdi:target',
        category: 'score',
        points: 15,
        criteria: { type: 'score_at_least', percent: 80 },
        active: true,
      },
      {
        key: 'score_100',
        title: 'Perfection',
        description: 'Obtenir 100% sur une session.',
        icon: 'mdi:crown',
        category: 'score',
        points: 30,
        criteria: { type: 'score_at_least', percent: 100 },
        active: true,
      },
      {
        key: 'exam_mode',
        title: 'Mode examen',
        description: 'Terminer une session en mode examen.',
        icon: 'mdi:shield-check',
        category: 'mode',
        points: 15,
        criteria: { type: 'finish_mode', mode: 'exam' },
        active: true,
      },
      {
        key: 'fast_finish',
        title: 'Rapide',
        description: 'Terminer une session en moins de 5 min.',
        icon: 'mdi:timer',
        category: 'speed',
        points: 10,
        criteria: { type: 'finish_under', seconds: 300 },
        active: true,
      },
      {
        key: 'streak_3',
        title: 'Régularité',
        description: 'Jouer 3 jours d’affilée.',
        icon: 'mdi:fire',
        category: 'streak',
        points: 20,
        criteria: { type: 'streak_days', days: 3 },
        active: true,
      },
      {
        key: 'favorite_10',
        title: 'Collectionneur',
        description: 'Ajouter 10 favoris.',
        icon: 'mdi:star',
        category: 'engagement',
        points: 10,
        criteria: { type: 'favorites_at_least', count: 10 },
        active: true,
      },
      {
        key: 'coop_session',
        title: 'Esprit d’équipe',
        description: 'Terminer une session coop.',
        icon: 'mdi:account-multiple-check',
        category: 'mode',
        points: 15,
        criteria: { type: 'finish_mode', mode: 'coop' },
        active: true,
      },
    ];
    await AchievementModel.insertMany(ACHIEVEMENTS);
    console.log(`🏅 Achievements injectés: ${ACHIEVEMENTS.length}`);

    // ====================
    // USERS
    // ====================
    const baseUsers = [
      {
        email: 'medy.student@example.com',
        password: 'medy2025',
        username: 'medy_student',
        firstName: 'Medy',
        lastName: 'Student',
        studyYear: 1,
        speciality: 'medecine' as const,
        role: 'user' as const,
      },
      {
        email: 'pharma.student@example.com',
        password: 'pharma2025',
        username: 'pharma_student',
        firstName: 'Pharma',
        lastName: 'Learner',
        studyYear: 3,
        speciality: 'pharmacie' as const,
        role: 'user' as const,
      },
      {
        email: 'admin@medy.app',
        password: 'admin2025',
        username: 'medy_admin',
        firstName: 'Medy',
        lastName: 'Admin',
        speciality: 'medecine' as const,
        role: 'admin' as const,
      },
    ];

    const extraUsers = Array.from({ length: EXTRA_USERS_COUNT }).map(
      (_, i) => {
        const speciality = SPECIALITIES[i % SPECIALITIES.length];
        const studyYear = STUDY_YEARS[i % STUDY_YEARS.length];
        const idx = i + 1;
        return {
          email: `student+${speciality}.${idx}@example.com`,
          password: 'password123',
          username: `student_${speciality}_${idx}`,
          firstName: `Student${idx}`,
          lastName: speciality.toUpperCase(),
          studyYear,
          speciality,
          role: 'user' as const,
        };
      },
    );

    const users = [...baseUsers, ...extraUsers];

    const hashedUsers = await Promise.all(
      users.map(async (user) => ({
        username: user.username,
        email: user.email,
        passwordHash: await bcrypt.hash(user.password, 10),
        isVerified: true,
        verifiedAt: new Date(),
        authProvider: ['email'],
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        studyYear: user.studyYear ?? null,
        speciality: user.speciality,
        stats: {},
        favorites: { questions: [] as Types.ObjectId[] },
      })),
    );

    const insertedUsers = await UserModel.insertMany(hashedUsers);
    console.log(`👤 Utilisateurs injectés: ${insertedUsers.length}`);

    const userByUsername = insertedUsers.reduce<
      Record<string, (typeof insertedUsers)[number]>
    >((acc, u) => {
      acc[u.username] = u;
      return acc;
    }, {});

    const friendships = [
      {
        requester: userByUsername['medy_student']?._id,
        recipient: userByUsername['pharma_student']?._id,
        status: 'accepted' as const,
        respondedAt: new Date(),
      },
      {
        requester: userByUsername['medy_student']?._id,
        recipient: userByUsername['medy_admin']?._id,
        status: 'accepted' as const,
        respondedAt: new Date(),
      },
    ].filter((f) => f.requester && f.recipient) as Array<{
      requester: Types.ObjectId;
      recipient: Types.ObjectId;
      status: 'accepted';
      respondedAt: Date;
    }>;

    if (friendships.length) {
      await FriendshipModel.insertMany(friendships);
      console.log('🤝 Amis injectés');
    }

    const uniBySpec: Record<string, string> = {
      medecine: 'UM1',
      pharmacie: 'USTHB',
      dentaire: 'Paris-Saclay',
    };

    // =========================
    // INSERTION DU CATALOGUE
    // =========================
    for (const entry of catalog) {
      const uniteDoc = await UniteModel.create(entry.unite);

      for (const moduleEntry of entry.modules) {
        const moduleDoc = await ModuleModel.create({
          nom: moduleEntry.nom,
          speciality: entry.unite.speciality,
          studyYear: entry.unite.studyYear,
          unite: uniteDoc._id,
        });

        for (const courseEntry of moduleEntry.courses) {
          const coursDoc = await CoursModel.create({
            nom: courseEntry.nom,
            studyYear: entry.unite.studyYear,
            module: moduleDoc._id,
          });

          const questionsToInsert = courseEntry.questions.map((question) => ({
            ...question,
            speciality: entry.unite.speciality,
            unite: uniteDoc._id,
            module: moduleDoc._id,
            cours: coursDoc._id,
            year: entry.unite.studyYear,
            qcmYear: currentYear,
            university: uniBySpec[entry.unite.speciality] ?? 'UM1',
          }));

          await QuestionModel.insertMany(questionsToInsert);
        }
      }
    }

    console.log('🎯 Catalogue académique réaliste injecté');

    // -------------------------------------------------
    // Utilisateur de test NON vérifié + lien à valider
    // -------------------------------------------------
    const unverified = await UserModel.create({
      username: 'eva_unverified',
      email: 'eva.unverified@example.com',
      passwordHash: await bcrypt.hash('test2025', 10),
      isVerified: false,
      authProvider: ['email'],
      role: 'user',
      firstName: 'Eva',
      lastName: 'Unverified',
      stats: {},
      favorites: { questions: [] as Types.ObjectId[] },
    });

    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes

    await UserModel.findByIdAndUpdate(unverified._id, {
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: expiresAt,
    });

    const baseUrl = process.env.EMAIL_VERIFICATION_URL ?? '';
    const separator = baseUrl.includes('?') ? '&' : '?';
    const verifyLink = `${baseUrl}${separator}token=${rawToken}&userId=${unverified._id}`;

    console.log('✉️  Utilisateur non vérifié de test créé:');
    console.log('    Email:', 'eva.unverified@example.com');
    console.log('    Mot de passe:', 'test2025');
    console.log('    Lien de vérification (copiez/collez dans le navigateur):');
    console.log('    ', verifyLink);

    // ==========================
    // Données de test supplémentaires simples
    // ==========================
    const extraUnites: Types.ObjectId[] = [];
    for (let i = 1; i <= 10; i++) {
      const speciality = SPECIALITIES[i % SPECIALITIES.length];
      const studyYear = (i % 7) + 1;
      const unite = await UniteModel.create({
        nom: `Unité Démo ${i}`,
        speciality,
        studyYear,
      });
      extraUnites.push(unite._id);
    }

    const extraModules: Types.ObjectId[] = [];
    for (let i = 1; i <= 10; i++) {
      const uniteId = extraUnites[(i - 1) % extraUnites.length];
      const uniteDoc = await UniteModel.findById(uniteId).lean();
      if (!uniteDoc) continue;
      const moduleDoc = await ModuleModel.create({
        nom: `Module Démo ${i}`,
        speciality: uniteDoc.speciality,
        studyYear: uniteDoc.studyYear,
        unite: uniteId,
      });
      extraModules.push(moduleDoc._id);
    }

    const extraCourses: Types.ObjectId[] = [];
    for (let i = 1; i <= 10; i++) {
      const moduleId = extraModules[(i - 1) % extraModules.length];
      const moduleDoc = await ModuleModel.findById(moduleId).lean();
      if (!moduleDoc) continue;
      const coursDoc = await CoursModel.create({
        nom: `Cours Démo ${i}`,
        studyYear: moduleDoc.studyYear,
        module: moduleId,
      });
      extraCourses.push(coursDoc._id);
    }

    const sampleQuestions = [
      {
        questionText:
          "Question démo: Quelle est la capitale de la France ?",
        options: ['Lyon', 'Marseille', 'Paris', 'Nice'],
        correctAnswer: [2],
      },
      {
        questionText: 'Question démo: 2 + 2 = ?',
        options: ['3', '4', '5', '22'],
        correctAnswer: [1],
      },
      {
        questionText:
          "Question démo: La molécule d'eau est composée de ?",
        options: ['H2O', 'CO2', 'O2', 'H2'],
        correctAnswer: [0],
      },
      {
        questionText:
          'Question démo: Le cœur humain possède ?',
        options: ['2 cavités', '3 cavités', '4 cavités', '5 cavités'],
        correctAnswer: [2],
      },
    ];

    let createdCount = 0;
    for (let i = 0; i < extraCourses.length; i++) {
      const coursId = extraCourses[i];
      const coursDoc = await CoursModel.findById(coursId).lean();
      if (!coursDoc) continue;
      const moduleDoc = await ModuleModel.findById(coursDoc.module).lean();
      if (!moduleDoc) continue;
      const uniteDoc = await UniteModel.findById(moduleDoc.unite).lean();
      if (!uniteDoc) continue;

      const qcmYear = i % 2 === 0 ? currentYear : currentYear - 1;
      const university =
        i % 3 === 0 ? 'UM1' : i % 3 === 1 ? 'USTHB' : 'Paris-Saclay';

      const pack = [
        sampleQuestions[i % sampleQuestions.length],
        sampleQuestions[(i + 1) % sampleQuestions.length],
      ];
      const docs = pack.map((q) => ({
        ...q,
        speciality: uniteDoc.speciality,
        unite: uniteDoc._id,
        module: moduleDoc._id,
        cours: coursDoc._id,
        year: uniteDoc.studyYear,
        qcmYear,
        university,
      }));
      const inserted = await QuestionModel.insertMany(docs);
      createdCount += inserted.length;
      if (createdCount >= 20) break;
    }

    console.log(
      `🧪 Données démo ajoutées: 10 unités, 10 modules, 10 cours, ${createdCount} questions`,
    );

    // ==========================
    // Burst de données mockées
    // ==========================
    const BULK_UNITES = BULK_UNITES_PER_SPEC;
    let bulkQuestions = 0;

    for (const speciality of SPECIALITIES) {
      for (let u = 1; u <= BULK_UNITES; u++) {
        const studyYear = (u % 7) + 1;
        const unite = await UniteModel.create({
          nom: `Unité ${speciality.toUpperCase()} ${u}`,
          speciality,
          studyYear,
        });

        for (let m = 1; m <= MODULES_PER_UNITE; m++) {
          const moduleDoc = await ModuleModel.create({
            nom: `Module ${u}.${m}`,
            speciality,
            studyYear,
            unite: unite._id,
          });

          for (let c = 1; c <= COURSES_PER_MODULE; c++) {
            const coursDoc = await CoursModel.create({
              nom: `Cours ${u}.${m}.${c}`,
              studyYear,
              module: moduleDoc._id,
            });

            const docs: any[] = [];
            for (let q = 1; q <= QUESTIONS_PER_COURSE; q++) {
              const optionCount = rand(4, 6);
              const options = Array.from(
                { length: optionCount },
                (_, i) => `Option ${i + 1}`,
              );
              const indexPool = Array.from(
                { length: optionCount },
                (_, i) => i,
              );
              const multi = Math.random() < 0.3;
              const correctAnswer = multi
                ? pickMany(
                    rand(2, Math.min(3, optionCount)),
                    indexPool,
                  )
                : [pick(indexPool)];

              docs.push({
                questionText: `(${speciality}) Q${u}.${m}.${c}.${q} — Thème démo`,
                options,
                correctAnswer,
                unite: unite._id,
                module: moduleDoc._id,
                cours: coursDoc._id,
                speciality,
                year: studyYear,
                qcmYear: pick(qcmYearsPool),
                university: pick(universities),
              });
            }
            await QuestionModel.insertMany(docs);
            bulkQuestions += docs.length;
          }
        }
      }
    }

    console.log(
      `📊 Burst mock: +${BULK_UNITES * SPECIALITIES.length} unités, +${
        BULK_UNITES * MODULES_PER_UNITE * SPECIALITIES.length
      } modules (x${COURSES_PER_MODULE}/u), +${bulkQuestions} questions`,
    );
  } catch (error) {
    console.error('❌ Erreur lors du seed :', error);
  } finally {
    await disconnect();
    console.log('🔌 Déconnexion MongoDB');
  }
}

seed();
