import { IMailService } from '../../application/ports/IMailService';
import { ImapMailService } from '../mail/ImapMailService';
import emailConfig from '../config/email';

/**
 * Factory for creating mail service
 */
export class EmailServiceFactory {
  private static mailService: IMailService | null = null;

  /**
   * Get the mail service instance
   */
  static getMailService(): IMailService {
    if (!this.mailService) {
      this.mailService = new ImapMailService(emailConfig);
    }
    return this.mailService;
  }

  /**
   * Reset the mail service instance
   */
  static reset(): void {
    this.mailService = null;
  }
}
