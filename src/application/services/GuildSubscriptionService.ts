import { IGuildSubscriptionRepository } from '../ports/IGuildSubscriptionRepository';
import { INewsletterRepository } from '../ports/INewsletterRepository';
import { GuildSubscription } from '../../domain/entities/GuildSubscription';
import { Newsletter } from '../../domain/entities/Newsletter';

export class GuildSubscriptionService {
  constructor(
    private readonly subscriptionRepository: IGuildSubscriptionRepository,
    private readonly newsletterRepository: INewsletterRepository,
  ) {}

  /**
   * Get all subscriptions for a guild
   */
  async getGuildSubscriptions(guildId: string): Promise<GuildSubscription[]> {
    return this.subscriptionRepository.getByGuildId(guildId);
  }

  /**
   * Get all newsletters subscribed by a guild
   */
  async getGuildNewsletters(guildId: string): Promise<Newsletter[]> {
    const subscriptions = await this.subscriptionRepository.getByGuildId(guildId);
    const newsletterIds = subscriptions.map((sub) => sub.newsletterId);

    // Get all newsletters and filter by IDs in subscriptions
    const allNewsletters = await this.newsletterRepository.getAll();
    return allNewsletters.filter((newsletter) => newsletterIds.includes(newsletter.id));
  }

  /**
   * Subscribe a guild to a newsletter
   */
  async subscribeGuildToNewsletter(
    guildId: string,
    channelId: string,
    newsletterId: string,
  ): Promise<GuildSubscription> {
    // Check if the newsletter exists
    const newsletter = await this.newsletterRepository.getById(newsletterId);
    if (!newsletter) {
      throw new Error(`Newsletter with ID ${newsletterId} not found`);
    }

    // Check if subscription already exists
    const existingSubscription = await this.subscriptionRepository.getByGuildAndNewsletter(
      guildId,
      newsletterId,
    );

    if (existingSubscription) {
      // If existing but in a different channel or inactive, update it
      if (existingSubscription.channelId !== channelId || !existingSubscription.active) {
        const updated =
          existingSubscription.channelId !== channelId
            ? existingSubscription.updateChannel(channelId).activate()
            : existingSubscription.activate();

        await this.subscriptionRepository.save(updated);
        return updated;
      }

      // Already subscribed to this newsletter on the same channel
      return existingSubscription;
    }

    // Create new subscription
    const subscription = GuildSubscription.create({
      guildId,
      channelId,
      newsletterId,
      active: true,
    });

    await this.subscriptionRepository.save(subscription);
    return subscription;
  }

  /**
   * Unsubscribe a guild from a newsletter
   */
  async unsubscribeGuildFromNewsletter(guildId: string, newsletterId: string): Promise<void> {
    // Check if the subscription exists
    const subscription = await this.subscriptionRepository.getByGuildAndNewsletter(
      guildId,
      newsletterId,
    );

    if (!subscription) {
      // Already not subscribed
      return;
    }

    // Deactivate the subscription (soft delete)
    const updated = subscription.deactivate();
    await this.subscriptionRepository.save(updated);
  }

  /**
   * Remove a guild from the system (hard delete all subscriptions)
   */
  async removeGuild(guildId: string): Promise<void> {
    await this.subscriptionRepository.deleteByGuildId(guildId);
  }

  /**
   * Change the channel for a newsletter subscription
   */
  async changeSubscriptionChannel(
    guildId: string,
    newsletterId: string,
    newChannelId: string,
  ): Promise<GuildSubscription> {
    // Check if the subscription exists
    const subscription = await this.subscriptionRepository.getByGuildAndNewsletter(
      guildId,
      newsletterId,
    );

    if (!subscription) {
      throw new Error(`Subscription for newsletter ${newsletterId} in guild ${guildId} not found`);
    }

    // Update the channel
    const updated = subscription.updateChannel(newChannelId);
    await this.subscriptionRepository.save(updated);

    return updated;
  }

  /**
   * Get all guilds subscribed to a newsletter
   */
  async getNewsletterSubscribers(newsletterId: string): Promise<string[]> {
    const subscriptions = await this.subscriptionRepository.getActiveByNewsletterId(newsletterId);
    return [...new Set(subscriptions.map((sub) => sub.guildId))];
  }
}
