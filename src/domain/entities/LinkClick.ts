import { randomUUID } from 'crypto';

export class LinkClick {
  private constructor(
    public readonly id: string,
    public readonly trackedLinkId: string,
    public readonly clickedAt: Date,
    public readonly userAgent?: string,
    public readonly ipHash?: string,
    public readonly guildId?: string,
  ) {}

  /**
   * Create a new Link Click record
   */
  public static create(params: {
    trackedLinkId: string;
    clickedAt?: Date;
    userAgent?: string;
    ipHash?: string;
    guildId?: string;
    id?: string;
  }): LinkClick {
    const {
      trackedLinkId,
      clickedAt = new Date(),
      userAgent,
      ipHash,
      guildId,
      id = randomUUID(),
    } = params;

    // Validation
    if (!trackedLinkId || trackedLinkId.trim().length === 0) {
      throw new Error('Tracked Link ID is required');
    }

    return new LinkClick(id, trackedLinkId, clickedAt, userAgent, ipHash, guildId);
  }
}
