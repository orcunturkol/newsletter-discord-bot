import { randomUUID } from 'crypto';

export class Newsletter {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly url: string,
    public readonly senderEmail: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly extractionPattern?: string,
  ) {}

  /**
   * Create a new Newsletter
   */
  public static create(params: {
    name: string;
    url: string;
    senderEmail: string;
    extractionPattern?: string;
    id?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): Newsletter {
    const {
      name,
      url,
      senderEmail,
      extractionPattern,
      id = randomUUID(),
      createdAt = new Date(),
      updatedAt = new Date(),
    } = params;

    // Validate the newsletter data
    if (!name || name.trim().length === 0) {
      throw new Error('Newsletter name is required');
    }

    if (!url || url.trim().length === 0) {
      throw new Error('Newsletter URL is required');
    }

    if (!senderEmail || senderEmail.trim().length === 0) {
      throw new Error('Sender email is required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmail)) {
      throw new Error('Invalid sender email format');
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid newsletter URL format');
    }

    return new Newsletter(
      id,
      name.trim(),
      url.trim(),
      senderEmail.trim().toLowerCase(),
      createdAt,
      updatedAt,
      extractionPattern,
    );
  }

  /**
   * Check if an email comes from this newsletter
   */
  public isFromSender(email: string): boolean {
    return this.senderEmail.toLowerCase() === email.toLowerCase();
  }
}
