import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Friendship, FriendshipDocument } from './schemas/friendship.schema';
import { UsersService } from '../users/users.service';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FriendsService {
  constructor(
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<FriendshipDocument>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private mapFriendship(
    doc: any,
    currentUser: Types.ObjectId,
  ) {
    const requester = doc.requester as any;
    const recipient = doc.recipient as any;
    const requesterId = String(requester?._id ?? requester);
    const recipientId = String(recipient?._id ?? recipient);
    const isRequester = requesterId === String(currentUser);
    const otherUser = isRequester ? recipient : requester;

    return {
      id: String(doc._id),
      _id: doc._id,
      status: doc.status,
      createdAt: doc.createdAt,
      respondedAt: doc.respondedAt,
      requester,
      recipient,
      direction: isRequester ? 'outgoing' : 'incoming',
      otherUser,
    };
  }

  private toObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Identifiant invalide');
    }
    return new Types.ObjectId(id);
  }

  async sendFriendRequest(requesterId: string, recipientId: string) {
    if (requesterId === recipientId) {
      throw new BadRequestException('Impossible de vous ajouter vous-même');
    }

    await this.usersService.findById(recipientId); // throws si absent

    const requester = this.toObjectId(requesterId);
    const recipient = this.toObjectId(recipientId);

    const existing = await this.friendshipModel.findOne({
      $or: [
        { requester, recipient },
        { requester: recipient, recipient: requester },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        throw new ConflictException('Vous êtes déjà amis.');
      }

      if (
        existing.requester.equals(requester) &&
        existing.status === 'pending'
      ) {
        throw new ConflictException('Invitation déjà envoyée.');
      }

      if (
        existing.requester.equals(recipient) &&
        existing.status === 'pending'
      ) {
        existing.status = 'accepted';
        existing.respondedAt = new Date();
        await existing.save();
        return existing;
      }

      if (existing.status === 'declined') {
        existing.requester = requester;
        existing.recipient = recipient;
        existing.status = 'pending';
        existing.respondedAt = undefined;
        await existing.save();
        return existing;
      }
    }

    const friendship = await this.friendshipModel.create({
      requester,
      recipient,
    });
    // Notify recipient of friend request
    await this.notificationsService.emit(recipient, 'friend_request', {
      fromUserId: String(requester),
    });
    await this.notificationsService.sendPushToUser(
      recipient.toHexString(),
      'Nouvelle invitation',
      "Vous avez reçu une demande d'ami.",
      { type: 'friend_request', fromUserId: String(requester) },
    );
    const populated = await this.friendshipModel
      .findById(friendship._id)
      .populate('requester', 'username firstName lastName email')
      .populate('recipient', 'username firstName lastName email')
      .lean();
    return this.mapFriendship(populated, requester);
  }

  async listFriendships(
    userId: string,
    status?: 'pending' | 'accepted' | 'declined',
  ) {
    const userObjectId = this.toObjectId(userId);
    const filter: any = {
      $or: [{ requester: userObjectId }, { recipient: userObjectId }],
    };
    if (status) {
      filter.status = status;
    }

    const list = await this.friendshipModel
      .find(filter)
      .populate('requester', 'username firstName lastName email')
      .populate('recipient', 'username firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();
    return list.map((f) => this.mapFriendship(f, userObjectId));
  }

  async listPendingIncoming(userId: string) {
    const recipient = this.toObjectId(userId);
    const pending = await this.friendshipModel
      .find({ recipient, status: 'pending' })
      .populate('requester', 'username firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();
    return pending.map((f) => this.mapFriendship(f, recipient));
  }

  async respondToRequest(
    userId: string,
    friendshipId: string,
    dto: RespondFriendRequestDto,
  ) {
    const friendship = await this.friendshipModel.findById(friendshipId);
    if (!friendship) {
      throw new NotFoundException('Invitation introuvable');
    }

    const userObjectId = this.toObjectId(userId);

    if (!friendship.recipient.equals(userObjectId)) {
      throw new BadRequestException(
        'Vous ne pouvez pas agir sur cette invitation',
      );
    }

    if (friendship.status !== 'pending') {
      throw new ConflictException('Invitation déjà traitée');
    }

    const accepted = dto.action === 'accept';
    friendship.status = accepted ? 'accepted' : 'declined';
    friendship.respondedAt = new Date();
    await friendship.save();
    if (accepted) {
      // Notify requester that friend request was accepted
      await this.notificationsService.emit(friendship.requester, 'friend_accepted', {
        byUserId: String(friendship.recipient),
      });
      await this.notificationsService.sendPushToUser(
        friendship.requester.toHexString(),
        'Invitation acceptée',
        'Votre demande d’ami a été acceptée.',
        { type: 'friend_accepted', byUserId: String(friendship.recipient) },
      );
    }
    const populated = await this.friendshipModel
      .findById(friendshipId)
      .populate('requester', 'username firstName lastName email')
      .populate('recipient', 'username firstName lastName email')
      .lean();
    return this.mapFriendship(populated, userObjectId);
  }

  async removeFriend(userId: string, otherUserId: string) {
    const userObjectId = this.toObjectId(userId);
    const otherObjectId = this.toObjectId(otherUserId);

    const friendship = await this.friendshipModel.findOne({
      $or: [
        { requester: userObjectId, recipient: otherObjectId },
        { requester: otherObjectId, recipient: userObjectId },
      ],
      status: 'accepted',
    });

    if (!friendship) {
      throw new NotFoundException('Relation introuvable');
    }

    await friendship.deleteOne();
    return { success: true, removedUserId: otherUserId };
  }
}
