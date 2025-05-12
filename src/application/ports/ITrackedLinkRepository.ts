import { TrackedLink } from '../../domain/entities/TrackedLink';

export interface ITrackedLinkRepository {
  /**
   * Get all tracked links
   */
  getAll(): Promise<TrackedLink[]>;

  /**
   * Find a tracked link by its ID
   */
  getById(id: string): Promise<TrackedLink | null>;

  /**
   * Find a tracked link by its tracking ID
   */
  getByTrackingId(trackingId: string): Promise<TrackedLink | null>;

  /**
   * Find tracked links by issue ID
   */
  getByIssueId(issueId: string): Promise<TrackedLink[]>;

  /**
   * Find tracked links by newsletter ID
   */
  getByNewsletterId(newsletterId: string): Promise<TrackedLink[]>;

  /**
   * Save a tracked link (create or update)
   */
  save(trackedLink: TrackedLink): Promise<void>;

  /**
   * Delete a tracked link
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a tracked link exists by original URL and issue ID
   */
  existsByUrlAndIssue(originalUrl: string, issueId: string): Promise<boolean>;
}
