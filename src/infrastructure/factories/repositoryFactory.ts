import { INewsletterRepository } from '../../application/ports/INewsletterRepository';
import { IGuildSubscriptionRepository } from '../../application/ports/IGuildSubscriptionRepository';
import { GoogleSheetsClient } from '../googlesheets/GoogleSheetsClient';
import { GoogleSheetsNewsletterRepository } from '../googlesheets/GoogleSheetsNewsletterRepository';
import { NewsletterService } from '../../application/services/NewsletterService';
import { GuildSubscriptionService } from '../../application/services/GuildSubscriptionService';
import { GoogleSheetsGuildSubscriptionRepository } from '../googlesheets/GoogleSheetsGuildSubscriptionRepository';
import { EmailServiceFactory } from './emailServiceFactory';
import { IIssueRepository, IMailService } from '../../application/ports';
import { PullInboxUseCase } from '../../application/usecases/PullInboxUseCase';
import { GoogleSheetsIssueRepository } from '../googlesheets/GoogleSheetsIssueRepository';
import { DiscordClient } from '../discord/DiscordClient';
import { DiscordServiceFactory } from './discordServiceFactory';
import { DispatchIssueUseCase } from '../../application/usecases/DispatchIssueUseCase';
import { HandleDiscordCommandsUseCase } from '../../application/usecases/HandleDiscordCommandsUseCase';

/**
 * Factory for creating repositories and services
 */
export class RepositoryFactory {
  private static sheetsClient: GoogleSheetsClient | null = null;
  private static newsletterRepository: INewsletterRepository | null = null;
  private static guildSubscriptionRepository: IGuildSubscriptionRepository | null = null;
  private static newsletterService: NewsletterService | null = null;
  private static guildSubscriptionService: GuildSubscriptionService | null = null;
  private static issueRepository: IIssueRepository | null = null;
  private static handleDiscordCommandsUseCase: HandleDiscordCommandsUseCase | null = null;

  /**
   * Get the Google Sheets client instance
   */
  static getSheetsClient(): GoogleSheetsClient {
    if (!this.sheetsClient) {
      this.sheetsClient = new GoogleSheetsClient();
    }
    return this.sheetsClient;
  }

  /**
   * Get the newsletter repository instance
   */
  static async getNewsletterRepository(): Promise<INewsletterRepository> {
    if (!this.newsletterRepository) {
      const sheetsClient = this.getSheetsClient();
      const repository = new GoogleSheetsNewsletterRepository(sheetsClient);
      await repository.initialize();
      this.newsletterRepository = repository;
    }
    return this.newsletterRepository!;
  }

  /**
   * Get the guild subscription repository instance
   */
  static async getGuildSubscriptionRepository(): Promise<IGuildSubscriptionRepository> {
    if (!this.guildSubscriptionRepository) {
      const sheetsClient = this.getSheetsClient();
      const repository = new GoogleSheetsGuildSubscriptionRepository(sheetsClient);
      await repository.initialize();
      this.guildSubscriptionRepository = repository;
    }
    return this.guildSubscriptionRepository!;
  }

  /**
   * Get the newsletter service instance
   */
  static async getNewsletterService(): Promise<NewsletterService> {
    if (!this.newsletterService) {
      const repository = await this.getNewsletterRepository();
      this.newsletterService = new NewsletterService(repository);
    }
    return this.newsletterService;
  }

  /**
   * Get the guild subscription service instance
   */
  static async getGuildSubscriptionService(): Promise<GuildSubscriptionService> {
    if (!this.guildSubscriptionService) {
      const subscriptionRepo = await this.getGuildSubscriptionRepository();
      const newsletterRepo = await this.getNewsletterRepository();
      this.guildSubscriptionService = new GuildSubscriptionService(
        subscriptionRepo,
        newsletterRepo,
      );
    }
    return this.guildSubscriptionService;
  }

  /**
   * Get the mail service instance
   */
  static getMailService(): IMailService {
    return EmailServiceFactory.getMailService();
  }

  /**
   * Get the issue repository instance
   */
  static async getIssueRepository(): Promise<IIssueRepository> {
    if (!this.issueRepository) {
      const sheetsClient = this.getSheetsClient();
      const repository = new GoogleSheetsIssueRepository(sheetsClient);
      await repository.initialize();
      this.issueRepository = repository;
    }
    return this.issueRepository;
  }

  /**
   * Get the PullInboxUseCase instance
   */
  static async getPullInboxUseCase(): Promise<PullInboxUseCase> {
    const mailService = this.getMailService();
    const newsletterRepository = await this.getNewsletterRepository();
    const issueRepository = await this.getIssueRepository();

    return new PullInboxUseCase(mailService, newsletterRepository, issueRepository);
  }

  /**
   * Get the Discord client instance
   */
  static async getDiscordClient(): Promise<DiscordClient> {
    return DiscordServiceFactory.getDiscordClient();
  }
  /**
   * Get the HandleDiscordCommandsUseCase instance
   */
  static async getHandleDiscordCommandsUseCase(): Promise<HandleDiscordCommandsUseCase> {
    if (!this.handleDiscordCommandsUseCase) {
      const guildSubscriptionRepository = await this.getGuildSubscriptionRepository();
      const newsletterRepository = await this.getNewsletterRepository();

      this.handleDiscordCommandsUseCase = new HandleDiscordCommandsUseCase(
        guildSubscriptionRepository,
        newsletterRepository,
      );
    }

    return this.handleDiscordCommandsUseCase;
  }
  /**
   * Get the DispatchIssueUseCase instance
   */
  static async getDispatchIssueUseCase(): Promise<DispatchIssueUseCase> {
    const issueRepository = await this.getIssueRepository();
    const guildSubscriptionRepository = await this.getGuildSubscriptionRepository();
    const discordClient = await this.getDiscordClient();

    return new DispatchIssueUseCase(issueRepository, guildSubscriptionRepository, discordClient);
  }

  /**
   * Reset all instances (useful for testing)
   */
  static reset(): void {
    this.sheetsClient = null;
    this.newsletterRepository = null;
    this.guildSubscriptionRepository = null;
    this.issueRepository = null;
    this.newsletterService = null;
    this.guildSubscriptionService = null;
    EmailServiceFactory.reset();
    DiscordServiceFactory.reset();
    this.handleDiscordCommandsUseCase = null;
  }
}
