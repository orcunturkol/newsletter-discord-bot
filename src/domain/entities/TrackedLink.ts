import { randomUUID } from 'crypto';

export class TrackedLink {
  private constructor(
    public readonly id: string,
    public readonly originalUrl: string,
    public readonly trackingId: string,
    public readonly issueId: string,
    public readonly newsletterId: string,
    public readonly createdAt: Date,
  ) {}

  /**
   * Create a new Tracked Link
   */
  public static create(params: {
    originalUrl: string;
    issueId: string;
    newsletterId: string;
    trackingId?: string;
    id?: string;
    createdAt?: Date;
  }): TrackedLink {
    const {
      originalUrl,
      issueId,
      newsletterId,
      trackingId = randomUUID().substring(0, 8),
      id = randomUUID(),
      createdAt = new Date(),
    } = params;

    // Validation
    if (!originalUrl || originalUrl.trim().length === 0) {
      throw new Error('Original URL is required');
    }

    if (!issueId || issueId.trim().length === 0) {
      throw new Error('Issue ID is required');
    }

    if (!newsletterId || newsletterId.trim().length === 0) {
      throw new Error('Newsletter ID is required');
    }

    // Basic URL validation
    try {
      new URL(originalUrl);
    } catch (error) {
      throw new Error('Invalid original URL format');
    }

    return new TrackedLink(id, originalUrl.trim(), trackingId, issueId, newsletterId, createdAt);
  }

  /**
   * Generate a tracking URL for this link
   * This will be the URL that is actually included in the Discord embed
   */
  public getTrackingUrl(baseUrl: string): string {
    // Make sure the base URL doesn't end with a slash
    const formattedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    return `${formattedBaseUrl}/t/${this.trackingId}`;
  }
}
