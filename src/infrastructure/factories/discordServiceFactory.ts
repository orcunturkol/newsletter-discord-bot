import { DiscordClient } from '../discord/DiscordClient';
import discordConfig from '../config/discord';

/**
 * Factory for creating Discord service
 */
export class DiscordServiceFactory {
  private static discordClient: DiscordClient | null = null;

  /**
   * Get the Discord client instance
   */
  static async getDiscordClient(): Promise<DiscordClient> {
    if (!this.discordClient) {
      this.discordClient = new DiscordClient(discordConfig.botToken, discordConfig.clientId);
      await this.discordClient.initialize();
    }
    return this.discordClient;
  }

  /**
   * Reset the Discord client instance
   */
  static reset(): void {
    this.discordClient = null;
  }
}
