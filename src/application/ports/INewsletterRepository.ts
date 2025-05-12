import { Newsletter } from '../../domain/entities/Newsletter';

export interface INewsletterRepository {
  /**
   * Get all newsletters
   */
  getAll(): Promise<Newsletter[]>;

  /**
   * Find a newsletter by its ID
   */
  getById(id: string): Promise<Newsletter | null>;

  /**
   * Find a newsletter by sender email
   */
  getBySenderEmail(email: string): Promise<Newsletter | null>;

  /**
   * Save a newsletter (create or update)
   */
  save(newsletter: Newsletter): Promise<void>;

  /**
   * Delete a newsletter by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a newsletter exists by sender email
   */
  existsBySenderEmail(email: string): Promise<boolean>;
}
