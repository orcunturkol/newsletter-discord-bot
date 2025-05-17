import { IGuildSubscriptionRepository } from '../ports/IGuildSubscriptionRepository';
import { INewsletterRepository } from '../ports/INewsletterRepository';
import { GuildSubscription } from '../../domain/entities/GuildSubscription';

export class HandleDiscordCommandsUseCase {
  constructor(
    private readonly guildSubscriptionRepository: IGuildSubscriptionRepository,
    private readonly newsletterRepository: INewsletterRepository,
  ) {}

  /**
   * List newsletter subscriptions for a channel
   */
  async listNewsletters(
    guildId: string,
    channelId: string,
  ): Promise<{
    subscriptions: Array<{
      id: string;
      newsletterId: string;
      newsletterName: string;
    }>;
  }> {
    // Get all subscriptions for this guild
    const allSubscriptions = await this.guildSubscriptionRepository.getByGuildId(guildId);

    // Filter by channel ID
    const channelSubscriptions = allSubscriptions.filter((sub) => sub.channelId === channelId);

    // Get newsletter details for each subscription
    const result = await Promise.all(
      channelSubscriptions.map(async (subscription) => {
        const newsletter = await this.newsletterRepository.getById(subscription.newsletterId);
        return {
          id: subscription.id,
          newsletterId: subscription.newsletterId,
          newsletterName: newsletter ? newsletter.name : 'Unknown Newsletter',
        };
      }),
    );

    return { subscriptions: result };
  }

  /**
   * Get all available newsletters
   */
  async getAvailableNewsletters(): Promise<
    Array<{
      id: string;
      name: string;
    }>
  > {
    const newsletters = await this.newsletterRepository.getAll();

    return newsletters.map((newsletter) => ({
      id: newsletter.id,
      name: newsletter.name,
    }));
  }

  /**
   * Subscribe a channel to a newsletter
   */
  async subscribeToNewsletter(
    guildId: string,
    channelId: string,
    newsletterId: string,
  ): Promise<{
    success: boolean;
    message: string;
    subscription?: {
      id: string;
      newsletterName: string;
    };
  }> {
    // Check if the newsletter exists
    const newsletter = await this.newsletterRepository.getById(newsletterId);
    if (!newsletter) {
      return {
        success: false,
        message: 'Newsletter not found',
      };
    }

    // Check if already subscribed
    const existingSubscription = await this.guildSubscriptionRepository.getByGuildAndNewsletter(
      guildId,
      newsletterId,
    );

    if (existingSubscription) {
      if (existingSubscription.channelId === channelId) {
        return {
          success: false,
          message: `This channel is already subscribed to "${newsletter.name}"`,
        };
      } else {
        return {
          success: false,
          message: `Already subscribed to "${newsletter.name}" in another channel`,
        };
      }
    }

    // Create new subscription
    const subscription = GuildSubscription.create({
      guildId,
      channelId,
      newsletterId,
      active: true,
    });

    await this.guildSubscriptionRepository.save(subscription);

    return {
      success: true,
      message: `Successfully subscribed to "${newsletter.name}"`,
      subscription: {
        id: subscription.id,
        newsletterName: newsletter.name,
      },
    };
  }

  /**
   * Unsubscribe a channel from a newsletter
   */
  async unsubscribeFromNewsletter(
    guildId: string,
    channelId: string,
    newsletterId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    // Check if the newsletter exists
    const newsletter = await this.newsletterRepository.getById(newsletterId);
    if (!newsletter) {
      return {
        success: false,
        message: 'Newsletter not found',
      };
    }

    // Check if subscribed
    const existingSubscription = await this.guildSubscriptionRepository.getByGuildAndNewsletter(
      guildId,
      newsletterId,
    );

    if (!existingSubscription) {
      return {
        success: false,
        message: `Not subscribed to "${newsletter.name}"`,
      };
    }

    if (existingSubscription.channelId !== channelId) {
      return {
        success: false,
        message: `Subscribed to "${newsletter.name}" in another channel`,
      };
    }

    // Delete subscription
    await this.guildSubscriptionRepository.delete(existingSubscription.id);

    return {
      success: true,
      message: `Successfully unsubscribed from "${newsletter.name}"`,
    };
  }
}
