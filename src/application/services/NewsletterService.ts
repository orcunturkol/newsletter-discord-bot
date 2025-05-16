import { INewsletterRepository } from '../ports/INewsletterRepository';
import { Newsletter } from '../../domain/entities/Newsletter';

export class NewsletterService {
  constructor(private readonly newsletterRepository: INewsletterRepository) {}

  /**
   * Get all newsletters
   */
  async getAllNewsletters(): Promise<Newsletter[]> {
    return this.newsletterRepository.getAll();
  }

  /**
   * Get a newsletter by ID
   */
  async getNewsletterById(id: string): Promise<Newsletter | null> {
    return this.newsletterRepository.getById(id);
  }

  /**
   * Find a newsletter by sender email
   */
  async findNewsletterBySenderEmail(email: string): Promise<Newsletter | null> {
    return this.newsletterRepository.getBySenderEmail(email);
  }

  /**
   * Add a new newsletter
   */
  async addNewsletter(params: {
    name: string;
    url: string;
    senderEmail: string;
    extractionPattern?: string;
  }): Promise<Newsletter> {
    // Check if newsletter with this email already exists
    const existing = await this.newsletterRepository.getBySenderEmail(params.senderEmail);
    if (existing) {
      throw new Error(`Newsletter with sender email ${params.senderEmail} already exists`);
    }

    // Create new newsletter
    const newsletter = Newsletter.create(params);

    // Save to repository
    await this.newsletterRepository.save(newsletter);

    return newsletter;
  }

  /**
   * Update an existing newsletter
   */
  async updateNewsletter(
    id: string,
    params: {
      name?: string;
      url?: string;
      senderEmail?: string;
      extractionPattern?: string;
    },
  ): Promise<Newsletter> {
    // Find existing newsletter
    const existing = await this.newsletterRepository.getById(id);
    if (!existing) {
      throw new Error(`Newsletter with ID ${id} not found`);
    }

    // Check if email is changing and ensure no conflict
    if (params.senderEmail && params.senderEmail !== existing.senderEmail) {
      const emailExists = await this.newsletterRepository.existsBySenderEmail(params.senderEmail);
      if (emailExists) {
        throw new Error(`Newsletter with sender email ${params.senderEmail} already exists`);
      }
    }

    // Create updated newsletter
    const updated = Newsletter.create({
      id: existing.id,
      name: params.name ?? existing.name,
      url: params.url ?? existing.url,
      senderEmail: params.senderEmail ?? existing.senderEmail,
      extractionPattern: params.extractionPattern ?? existing.extractionPattern,
    });

    // Save to repository
    await this.newsletterRepository.save(updated);

    return updated;
  }

  /**
   * Delete a newsletter
   */
  async deleteNewsletter(id: string): Promise<void> {
    // Check if newsletter exists
    const existing = await this.newsletterRepository.getById(id);
    if (!existing) {
      throw new Error(`Newsletter with ID ${id} not found`);
    }

    // Delete from repository
    await this.newsletterRepository.delete(id);
  }
}
