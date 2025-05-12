import { randomUUID } from 'crypto';

export class Issue {
  private constructor(
    public readonly id: string,
    public readonly newsletterId: string,
    public readonly title: string,
    public readonly webUrl: string,
    public readonly receivedAt: Date,
    public readonly content?: string,
    public readonly messageId?: string,
    public readonly processed: boolean = false,
  ) {}

  /**
   * Create a new Issue
   */
  public static create(params: {
    newsletterId: string;
    title: string;
    webUrl: string;
    receivedAt?: Date;
    content?: string;
    messageId?: string;
    id?: string;
    processed?: boolean;
  }): Issue {
    const {
      newsletterId,
      title,
      webUrl,
      receivedAt = new Date(),
      content,
      messageId,
      id = randomUUID(),
      processed = false,
    } = params;

    // Validation
    if (!newsletterId || newsletterId.trim().length === 0) {
      throw new Error('Newsletter ID is required');
    }

    if (!title || title.trim().length === 0) {
      throw new Error('Issue title is required');
    }

    if (!webUrl || webUrl.trim().length === 0) {
      throw new Error('Web URL is required');
    }

    // Basic URL validation
    try {
      new URL(webUrl);
    } catch (error) {
      throw new Error('Invalid web URL format');
    }

    return new Issue(
      id,
      newsletterId,
      title.trim(),
      webUrl.trim(),
      receivedAt,
      content,
      messageId,
      processed,
    );
  }

  /**
   * Mark this issue as processed
   */
  public markAsProcessed(): Issue {
    return new Issue(
      this.id,
      this.newsletterId,
      this.title,
      this.webUrl,
      this.receivedAt,
      this.content,
      this.messageId,
      true,
    );
  }

  /**
   * Create a copy of this issue with updated properties
   */
  public update(params: Partial<Omit<Issue, 'id'>>): Issue {
    return new Issue(
      this.id,
      params.newsletterId ?? this.newsletterId,
      params.title ?? this.title,
      params.webUrl ?? this.webUrl,
      params.receivedAt ?? this.receivedAt,
      params.content ?? this.content,
      params.messageId ?? this.messageId,
      params.processed ?? this.processed,
    );
  }
}
