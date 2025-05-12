import { Issue } from '../../domain/entities/Issue';

export interface IIssueRepository {
  /**
   * Get all issues
   */
  getAll(): Promise<Issue[]>;

  /**
   * Find an issue by its ID
   */
  getById(id: string): Promise<Issue | null>;

  /**
   * Find issues by newsletter ID
   */
  getByNewsletterId(newsletterId: string): Promise<Issue[]>;

  /**
   * Find issues by message ID (email message ID)
   */
  getByMessageId(messageId: string): Promise<Issue | null>;

  /**
   * Get unprocessed issues
   */
  getUnprocessed(): Promise<Issue[]>;

  /**
   * Save an issue (create or update)
   */
  save(issue: Issue): Promise<void>;

  /**
   * Delete an issue
   */
  delete(id: string): Promise<void>;

  /**
   * Mark an issue as processed
   */
  markAsProcessed(id: string): Promise<void>;

  /**
   * Check if an issue exists by message ID
   */
  existsByMessageId(messageId: string): Promise<boolean>;
}
