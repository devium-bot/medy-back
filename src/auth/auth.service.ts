import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RegisterDto } from './dto/register.dto';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpService } from '../otp/otp.service';
import { OAuth2Client } from 'google-auth-library';
import { MailService } from '../mail/mail.service';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly emailTokenExpiresInMinutes = 60;
  private readonly emailVerificationEnabled: boolean;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
    private usersService: UsersService,
    private mailService: MailService,
  ) {
    this.emailVerificationEnabled =
      this.configService.get<boolean>('EMAIL_VERIFICATION_ENABLED') ?? true;
  }

  async registerLocal(dto: RegisterDto) {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      studyYear,
      speciality,
    } = dto;

    const normalizedEmail = email.trim().toLowerCase();

    const existed = await this.userModel
      .findOne({ $or: [{ username }, { email: normalizedEmail }] })
      .lean();
    if (existed)
      throw new BadRequestException('Username or email already used');

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(password, salt);

    const created = await this.userModel.create({
      username,
      email: normalizedEmail,
      passwordHash: hash,
      firstName,
      lastName,
      studyYear,
      speciality,
      authProvider: ['email'],
      role: 'user',
      isVerified: !this.emailVerificationEnabled,
      verifiedAt: this.emailVerificationEnabled ? undefined : new Date(),
    } as any);

    if (this.emailVerificationEnabled) {
      await this.issueEmailVerificationToken(created, normalizedEmail);
    }

    return {
      message:
        this.emailVerificationEnabled
          ? 'Inscription réussie. Vérifiez votre boîte mail pour confirmer votre adresse.'
          : 'Inscription réussie. Vous pouvez vous connecter.',
      requiresVerification: this.emailVerificationEnabled,
      userId: String(created._id),
    };
  }

  async registerAdmin(dto: RegisterAdminDto) {
    const setupToken = this.configService.get<string>('ADMIN_SETUP_TOKEN');
    if (!setupToken) {
      throw new BadRequestException('Création administrateur désactivée.');
    }
    const { token: providedToken, password, ...rest } = dto;
    if (providedToken !== setupToken) {
      throw new UnauthorizedException("Jeton d'initialisation invalide");
    }

    rest.email = rest.email.trim().toLowerCase();

    const existed = await this.userModel
      .findOne({
        $or: [{ username: rest.username }, { email: rest.email }],
      })
      .lean();
    if (existed) {
      throw new BadRequestException('Username or email already used');
    }

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(password, salt);

    const created = await this.userModel.create({
      ...rest,
      passwordHash: hash,
      authProvider: ['email'],
      role: 'admin',
      isVerified: true,
      verifiedAt: new Date(),
    } as any);

    return this.signUser(created as any);
  }

  async validateUserByEmail(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email: normalizedEmail });
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (this.emailVerificationEnabled && !user.isVerified) {
      throw new UnauthorizedException(
        'Email non vérifié. Veuillez confirmer votre adresse.',
      );
    }

    return user;
  }

  async loginLocal(user: UserDocument) {
    return this.signUser(user);
  }

  async loginAdmin(email: string, password: string) {
    const user = await this.validateUserByEmail(email, password);
    if (user.role !== 'admin') {
      throw new UnauthorizedException('Admin privileges required');
    }
    return this.signUser(user);
  }

  signUser(user: UserDocument | any) {
    const id = user._id ? String(user._id) : undefined;
    const tokenVersion =
      typeof user.tokenVersion === 'number' ? user.tokenVersion : 0;

    const payload = {
      sub: id,
      email: user.email ?? null,
      provider: user.authProvider ?? null,
      role: user.role ?? 'user',
      tokenVersion,
    };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id,
        username: user.username ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        studyYear: user.studyYear ?? null,
        speciality: user.speciality ?? null,
        showPublicStats: user.showPublicStats ?? true,
        showPublicAchievements: user.showPublicAchievements ?? true,
        authProvider: Array.isArray(user.authProvider) ? user.authProvider : [],
        role: user.role ?? 'user',
        isVerified: Boolean(user.isVerified),
        verifiedAt: user.verifiedAt ?? null,
        tokenVersion,
      },
    };
  }

  // Google token-based login (frontend sends id_token)
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  async verifyGoogleToken(idToken: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) throw new UnauthorizedException('Invalid Google token');

      const email = payload.email; // string garanti
      const firstName = payload.given_name || '';
      const lastName = payload.family_name || '';
      // Vérifier ou créer l’utilisateur

      if (!email) {
        throw new UnauthorizedException('We can not find your Google acount ');
      }

      let user = await this.usersService.findByEmail(email);
      if (!user) {
        user = await this.usersService.createByGoogle(
          email,
          firstName,
          lastName,
        );
      }

      return this.signUser(user as any);
    } catch (err) {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  // Phone OTP flow: (1) send OTP (no code), (2) verify with code -> sign in / create
  async loginWithPhone(phone: string, code?: string) {
    if (!code) {
      // 1️⃣ Envoi OTP
      return this.otpService.sendOtp(phone);
    }

    // 2️⃣ Vérification OTP
    const valid = this.otpService.verifyOtp(phone, code);
    if (!valid) throw new BadRequestException('OTP invalide ou expiré');

    // 3️⃣ Trouver ou créer l'utilisateur
    let user = await this.usersService.findByPhone(phone);
    if (!user) {
      user = await this.usersService.createByPhone(phone);
    }

    if (!user.isVerified) {
      user.isVerified = true;
      user.verifiedAt = new Date();
      await user.save();
    }

    const freshUser = await this.userModel
      .findById(user._id)
      .select('-passwordHash')
      .lean();

    const payload = { sub: user._id, phone: user.phone };
    const authProviders =
      Array.isArray(freshUser?.authProvider) &&
      freshUser.authProvider.length > 0
        ? freshUser.authProvider
        : ['phone'];

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: String(user._id),
        username: freshUser?.username ?? user.username,
        phone: freshUser?.phone ?? user.phone ?? null,
        email: freshUser?.email ?? user.email ?? null,
        firstName: freshUser?.firstName ?? user.firstName ?? null,
        lastName: freshUser?.lastName ?? user.lastName ?? null,
        studyYear: freshUser?.studyYear ?? user.studyYear ?? null,
        speciality: freshUser?.speciality ?? user.speciality ?? null,
        authProvider: authProviders,
        role: freshUser?.role ?? user.role ?? 'user',
        isVerified: Boolean(freshUser?.isVerified ?? user.isVerified),
        verifiedAt: freshUser?.verifiedAt ?? user.verifiedAt ?? null,
      },
    };
  }

  async verifyEmail(userId: string, token: string) {
    if (!this.emailVerificationEnabled) {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Lien de vérification invalide.');
      }
      let user = await this.userModel
        .findById(userId)
        .select('-passwordHash')
        .lean();
      if (!user) {
        throw new NotFoundException('Utilisateur introuvable.');
      }
      if (!user.isVerified) {
        await this.userModel.findByIdAndUpdate(userId, {
          isVerified: true,
          verifiedAt: new Date(),
          $unset: {
            verificationTokenHash: 1,
            verificationTokenExpiresAt: 1,
          },
        });
        user = await this.userModel
          .findById(userId)
          .select('-passwordHash')
          .lean();
        if (!user) {
          throw new NotFoundException('Utilisateur introuvable.');
        }
      }
      return this.signUser({
        ...user,
        isVerified: true,
        verifiedAt: user.verifiedAt ?? new Date(),
      });
    }

    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Lien de vérification invalide.');
    }
    const trimmedToken = token?.trim();
    if (!trimmedToken) {
      throw new BadRequestException('Token de vérification manquant.');
    }

    const user = await this.userModel
      .findById(userId)
      .select(
        '+verificationTokenHash +verificationTokenExpiresAt -passwordHash',
      );

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    if (user.isVerified) {
      return this.signUser(user as any);
    }

    if (!user.verificationTokenHash) {
      throw new BadRequestException('Lien de vérification invalide ou expiré.');
    }

    const incomingHash = createHash('sha256').update(trimmedToken).digest('hex');
    if (incomingHash !== user.verificationTokenHash) {
      throw new BadRequestException('Lien de vérification invalide.');
    }

    if (
      !user.verificationTokenExpiresAt ||
      user.verificationTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Le lien de vérification a expiré.');
    }

    user.isVerified = true;
    user.verifiedAt = new Date();
    user.verificationTokenHash = undefined;
    user.verificationTokenExpiresAt = undefined;
    user.set('verificationTokenHash', undefined);
    user.set('verificationTokenExpiresAt', undefined);
    await user.save();

    const freshUser = await this.userModel
      .findById(user._id)
      .select('-passwordHash')
      .lean();

    if (!freshUser) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    return this.signUser(freshUser as any);
  }

  async resendVerification(email: string) {
    if (!this.emailVerificationEnabled) {
      throw new BadRequestException(
        'La vérification des e-mails est désactivée.',
      );
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .select(
        '+verificationTokenHash +verificationTokenExpiresAt -passwordHash',
      );

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    if (user.isVerified) {
      throw new BadRequestException('Cette adresse e-mail est déjà vérifiée.');
    }

    await this.issueEmailVerificationToken(user, user.email ?? normalizedEmail);

    return {
      message: 'Un nouvel e-mail de vérification a été envoyé.',
      userId: String(user._id),
    };
  }

  async logoutAll(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Utilisateur invalide.');
    }
    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { $inc: { tokenVersion: 1 } },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    return { success: true };
  }

  private async issueEmailVerificationToken(
    user: UserDocument,
    email: string,
  ) {
    if (!this.emailVerificationEnabled) {
      return;
    }

    const recipient = email.trim().toLowerCase();
    if (!recipient) {
      throw new BadRequestException(
        'Une adresse e-mail valide est requise pour la vérification.',
      );
    }

    const rawToken = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + this.emailTokenExpiresInMinutes * 60 * 1000,
    );

    user.verificationTokenHash = tokenHash;
    user.verificationTokenExpiresAt = expiresAt;
    user.isVerified = false;
    user.verifiedAt = undefined;
    await user.save();

    const baseUrl =
      this.configService.get<string>('EMAIL_VERIFICATION_URL') ?? '';
    const verificationLink = this.buildVerificationLink(
      baseUrl,
      rawToken,
      user._id,
    );

    await this.mailService.sendEmailVerification({
      to: recipient,
      verificationLink,
      token: rawToken.slice(0, 6),
      username: user.username,
      expiresInMinutes: this.emailTokenExpiresInMinutes,
    });
  }

  private buildVerificationLink(
    baseUrl: string,
    rawToken: string,
    userId: Types.ObjectId | string,
  ) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('token', rawToken);
      url.searchParams.set('userId', String(userId));
      return url.toString();
    } catch {
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}token=${rawToken}&userId=${userId}`;
    }
  }
}
