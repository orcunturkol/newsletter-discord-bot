import { GuildSubscription } from '../../domain/entities/GuildSubscription';

export interface IGuildSubscriptionRepository {
  /**
   * Get all guild subscriptions
   */
  getAll(): Promise<GuildSubscription[]>;

  /**
   * Find a subscription by its ID
   */
  getById(id: string): Promise<GuildSubscription | null>;

  /**
   * Find subscriptions by guild ID
   */
  getByGuildId(guildId: string): Promise<GuildSubscription[]>;

  /**
   * Find subscriptions by newsletter ID
   */
  getByNewsletterId(newsletterId: string): Promise<GuildSubscription[]>;

  /**
   * Find active subscriptions by newsletter ID
   */
  getActiveByNewsletterId(newsletterId: string): Promise<GuildSubscription[]>;

  /**
   * Find subscription by guild ID and newsletter ID
   */
  getByGuildAndNewsletter(guildId: string, newsletterId: string): Promise<GuildSubscription | null>;

  /**
   * Save a subscription (create or update)
   */
  save(subscription: GuildSubscription): Promise<void>;

  /**
   * Delete a subscription
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all subscriptions for a guild
   */
  deleteByGuildId(guildId: string): Promise<void>;

  /**
   * Check if a subscription exists for a guild and newsletter
   */
  existsByGuildAndNewsletter(guildId: string, newsletterId: string): Promise<boolean>;
}
