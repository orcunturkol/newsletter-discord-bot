import { INewsletterRepository } from '../../application/ports/INewsletterRepository';
import { Newsletter } from '../../domain/entities/Newsletter';
import { GoogleSheetsClient } from './GoogleSheetsClient';
import {
  validateSheetHeaders,
  mapRowToObject,
  getColumnIndex,
} from '../../shared/utils/sheetValidator';

export class GoogleSheetsNewsletterRepository implements INewsletterRepository {
  private readonly sheetName = 'Sheet1';
  private readonly requiredHeaders = ['ID', 'Name', 'URL', 'SenderEmail', 'ExtractionPattern'];
  private headerRow: string[] = [];
  private cache: Map<string, Newsletter> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly cacheTTL = 60000; // 1 minute cache TTL

  constructor(private readonly sheetsClient: GoogleSheetsClient) {}

  /**
   * Initialize the repository by validating the sheet structure
   */
  async initialize(): Promise<void> {
    const data = await this.sheetsClient.getSheetData(this.sheetName);

    if (!data || data.length === 0) {
      throw new Error(`Sheet "${this.sheetName}" is empty or does not exist`);
    }

    this.headerRow = data[0].map(String);
    validateSheetHeaders(this.headerRow, this.requiredHeaders, this.sheetName);
  }

  /**
   * Get all newsletters
   */
  async getAll(): Promise<Newsletter[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.cache.values());
  }

  /**
   * Find a newsletter by its ID
   */
  async getById(id: string): Promise<Newsletter | null> {
    await this.refreshCacheIfNeeded();
    return this.cache.get(id) || null;
  }

  /**
   * Find a newsletter by sender email (exact match)
   */
  async getBySenderEmail(email: string): Promise<Newsletter | null> {
    if (!email) {
      throw new Error('Email is required');
    }

    await this.refreshCacheIfNeeded();

    const normalizedEmail = email.toLowerCase().trim();

    // Search in cache
    for (const newsletter of this.cache.values()) {
      if (newsletter.senderEmail.toLowerCase() === normalizedEmail) {
        return newsletter;
      }
    }

    return null;
  }

  /**
   * Find newsletters by email domain
   */
  async getByEmailDomain(domain: string): Promise<Newsletter[]> {
    if (!domain) {
      throw new Error('Domain is required');
    }

    await this.refreshCacheIfNeeded();

    const normalizedDomain = domain.toLowerCase().trim();
    const results: Newsletter[] = [];

    // Search in cache
    for (const newsletter of this.cache.values()) {
      const emailDomain = newsletter.senderEmail.split('@')[1]?.toLowerCase();
      if (emailDomain === normalizedDomain) {
        results.push(newsletter);
      }
    }

    return results;
  }

  /**
   * Find newsletters by partial email match
   */
  async searchByPartialEmail(partialEmail: string): Promise<Newsletter[]> {
    if (!partialEmail) {
      throw new Error('Partial email is required');
    }

    await this.refreshCacheIfNeeded();

    const normalizedPartial = partialEmail.toLowerCase().trim();
    const results: Newsletter[] = [];

    // Search in cache
    for (const newsletter of this.cache.values()) {
      if (newsletter.senderEmail.toLowerCase().includes(normalizedPartial)) {
        results.push(newsletter);
      }
    }

    return results;
  }

  /**
   * Save a newsletter (create or update)
   */
  async save(newsletter: Newsletter): Promise<void> {
    await this.ensureInitialized();

    const data = await this.sheetsClient.getSheetData(this.sheetName);
    const idIndex = getColumnIndex(this.headerRow, 'ID');

    // Check if newsletter already exists
    let existingRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > idIndex && row[idIndex] === newsletter.id) {
        existingRowIndex = i;
        break;
      }
    }

    const newRow = this.newsletterToRow(newsletter);

    if (existingRowIndex !== -1) {
      // Update existing row
      await this.sheetsClient.updateSheetData(
        this.sheetName,
        `A${existingRowIndex + 1}:E${existingRowIndex + 1}`,
        [newRow],
      );
    } else {
      // Append new row
      await this.sheetsClient.appendSheetData(this.sheetName, [newRow]);
    }

    // Update cache
    this.cache.set(newsletter.id, newsletter);
  }

  /**
   * Delete a newsletter by ID
   */
  async delete(id: string): Promise<void> {
    // Note: Google Sheets API doesn't have a direct delete method
    // One approach is to get all data, filter out the row to delete, then rewrite the sheet
    // This is a simplistic implementation and not very efficient for large sheets
    await this.ensureInitialized();

    const data = await this.sheetsClient.getSheetData(this.sheetName);
    const idIndex = getColumnIndex(this.headerRow, 'ID');

    const filteredData = data.filter((row, index) => {
      // Keep header row and rows that don't match the ID
      return index === 0 || row[idIndex] !== id;
    });

    // If we didn't filter anything out, the newsletter doesn't exist
    if (filteredData.length === data.length) {
      return;
    }

    // Clear the entire sheet
    await this.sheetsClient.updateSheetData(
      this.sheetName,
      `A1:${String.fromCharCode(65 + this.headerRow.length - 1)}${data.length}`,
      filteredData,
    );

    // Remove from cache
    this.cache.delete(id);
  }

  /**
   * Check if a newsletter exists by sender email
   */
  async existsBySenderEmail(email: string): Promise<boolean> {
    const newsletter = await this.getBySenderEmail(email);
    return newsletter !== null;
  }

  /**
   * Ensure the repository is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.headerRow.length === 0) {
      await this.initialize();
    }
  }

  /**
   * Refresh the cache if it's expired
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    await this.ensureInitialized();

    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheTTL || this.cache.size === 0) {
      await this.refreshCache();
    }
  }

  /**
   * Refresh the newsletter cache from Google Sheets
   */
  private async refreshCache(): Promise<void> {
    const data = await this.sheetsClient.getSheetData(this.sheetName);

    // Clear the cache
    this.cache.clear();

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > 0) {
        try {
          const newsletter = this.rowToNewsletter(row);
          this.cache.set(newsletter.id, newsletter);
        } catch (error) {
          console.error(`Error parsing newsletter row ${i + 1}:`, error);
          // Continue with other rows
        }
      }
    }

    this.lastCacheUpdate = Date.now();
  }

  /**
   * Convert a row from Google Sheets to a Newsletter entity
   */
  private rowToNewsletter(row: string[]): Newsletter {
    const obj = mapRowToObject(row, this.headerRow);

    return Newsletter.create({
      id: obj.ID,
      name: obj.Name,
      url: obj.URL,
      senderEmail: obj.SenderEmail,
      extractionPattern: obj.ExtractionPattern || undefined,
    });
  }

  /**
   * Convert a Newsletter entity to a row for Google Sheets
   */
  private newsletterToRow(newsletter: Newsletter): string[] {
    const row: string[] = [];

    // Ensure columns are in the right order
    this.headerRow.forEach((header) => {
      switch (header) {
        case 'ID':
          row.push(newsletter.id);
          break;
        case 'Name':
          row.push(newsletter.name);
          break;
        case 'URL':
          row.push(newsletter.url);
          break;
        case 'SenderEmail':
          row.push(newsletter.senderEmail);
          break;
        case 'ExtractionPattern':
          row.push(newsletter.extractionPattern || '');
          break;
        default:
          row.push(''); // For any unknown columns
      }
    });

    return row;
  }
}
