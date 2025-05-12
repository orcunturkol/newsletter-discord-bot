import { LinkClick } from '../../domain/entities/LinkClick';

export interface ILinkClickRepository {
  /**
   * Get all link clicks
   */
  getAll(): Promise<LinkClick[]>;

  /**
   * Find a link click by its ID
   */
  getById(id: string): Promise<LinkClick | null>;

  /**
   * Find link clicks by tracked link ID
   */
  getByTrackedLinkId(trackedLinkId: string): Promise<LinkClick[]>;

  /**
   * Find link clicks by tracked link IDs
   */
  getByTrackedLinkIds(trackedLinkIds: string[]): Promise<LinkClick[]>;

  /**
   * Count clicks for a specific newsletter within a date range
   */
  countByNewsletterIdAndDateRange(
    newsletterId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number>;

  /**
   * Save a link click
   */
  save(linkClick: LinkClick): Promise<void>;

  /**
   * Delete a link click
   */
  delete(id: string): Promise<void>;
}
