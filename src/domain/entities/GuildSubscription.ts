import { randomUUID } from 'crypto';

export class GuildSubscription {
  private constructor(
    public readonly id: string,
    public readonly guildId: string,
    public readonly channelId: string,
    public readonly newsletterId: string,
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * Create a new Guild Subscription
   */
  public static create(params: {
    guildId: string;
    channelId: string;
    newsletterId: string;
    active?: boolean;
    id?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): GuildSubscription {
    const {
      guildId,
      channelId,
      newsletterId,
      active = true,
      id = randomUUID(),
      createdAt = new Date(),
      updatedAt = new Date(),
    } = params;

    // Validation
    if (!guildId || guildId.trim().length === 0) {
      throw new Error('Guild ID is required');
    }

    if (!channelId || channelId.trim().length === 0) {
      throw new Error('Channel ID is required');
    }

    if (!newsletterId || newsletterId.trim().length === 0) {
      throw new Error('Newsletter ID is required');
    }

    // Discord IDs are snowflakes - numeric strings
    const discordIdRegex = /^\d{17,20}$/;
    if (!discordIdRegex.test(guildId)) {
      throw new Error('Invalid Guild ID format');
    }

    if (!discordIdRegex.test(channelId)) {
      throw new Error('Invalid Channel ID format');
    }

    return new GuildSubscription(
      id,
      guildId,
      channelId,
      newsletterId,
      active,
      createdAt,
      updatedAt,
    );
  }

  /**
   * Activate this subscription
   */
  public activate(): GuildSubscription {
    if (this.active) return this;

    return new GuildSubscription(
      this.id,
      this.guildId,
      this.channelId,
      this.newsletterId,
      true,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Deactivate this subscription
   */
  public deactivate(): GuildSubscription {
    if (!this.active) return this;

    return new GuildSubscription(
      this.id,
      this.guildId,
      this.channelId,
      this.newsletterId,
      false,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Update the channel ID for this subscription
   */
  public updateChannel(channelId: string): GuildSubscription {
    if (!channelId || channelId.trim().length === 0) {
      throw new Error('Channel ID is required');
    }

    const discordIdRegex = /^\d{17,20}$/;
    if (!discordIdRegex.test(channelId)) {
      throw new Error('Invalid Channel ID format');
    }

    return new GuildSubscription(
      this.id,
      this.guildId,
      channelId,
      this.newsletterId,
      this.active,
      this.createdAt,
      new Date(),
    );
  }
}
