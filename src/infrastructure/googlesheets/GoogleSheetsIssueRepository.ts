import { IIssueRepository } from '../../application/ports/IIssueRepository';
import { Issue } from '../../domain/entities/Issue';
import { GoogleSheetsClient } from './GoogleSheetsClient';
import {
  validateSheetHeaders,
  mapRowToObject,
  getColumnIndex,
} from '../../shared/utils/sheetValidator';

export class GoogleSheetsIssueRepository implements IIssueRepository {
  private readonly sheetName = 'Issues';
  private readonly requiredHeaders = [
    'ID',
    'NewsletterID',
    'Title',
    'WebURL',
    'ReceivedAt',
    'MessageID',
    'Processed',
  ];
  private headerRow: string[] = [];
  private cache: Map<string, Issue> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly cacheTTL = 60000; // 1 minute cache TTL

  constructor(private readonly sheetsClient: GoogleSheetsClient) {}

  /**
   * Initialize the repository by validating the sheet structure
   */
  async initialize(): Promise<void> {
    try {
      // First check if the sheet exists
      const sheetsList = await this.sheetsClient.getSheets();

      if (!sheetsList.includes(this.sheetName)) {
        console.log(`Sheet "${this.sheetName}" doesn't exist. Creating it now...`);
        await this.createIssuesSheet();
        return;
      }

      // If sheet exists, validate headers
      const data = await this.sheetsClient.getSheetData(this.sheetName, 'A1:G1');

      if (!data || data.length === 0) {
        console.log(`Sheet "${this.sheetName}" exists but is empty. Adding headers...`);
        await this.sheetsClient.updateSheetData(this.sheetName, 'A1:G1', [this.requiredHeaders]);
        this.headerRow = this.requiredHeaders;
      } else {
        this.headerRow = data[0].map(String);
        validateSheetHeaders(this.headerRow, this.requiredHeaders, this.sheetName);
      }
    } catch (error) {
      console.error(`Error initializing Issues repository:`, error);

      // If we got an error due to the sheet not existing
      if (
        (error as Error).message?.includes('not found') ||
        (error as Error).message?.includes('does not exist') ||
        (error as Error).message?.includes('Unable to parse range')
      ) {
        console.log(`Attempting to create sheet "${this.sheetName}"...`);
        await this.createIssuesSheet();
      } else {
        throw error;
      }
    }
  }

  /**
   * Create the Issues sheet with required headers
   */
  private async createIssuesSheet(): Promise<void> {
    try {
      console.log(`Creating ${this.sheetName} sheet...`);

      // Check if sheet exists first
      const sheets = await this.sheetsClient.getSheets();
      if (!sheets.includes(this.sheetName)) {
        await this.sheetsClient.createSheet(this.sheetName);
        console.log(`Created ${this.sheetName} sheet`);

        // Wait a moment for Google Sheets to process the new sheet
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Add header row
      console.log(`Adding headers to ${this.sheetName} sheet...`);
      await this.sheetsClient.updateSheetData(this.sheetName, 'A1:G1', [this.requiredHeaders]);

      // Update headerRow
      this.headerRow = this.requiredHeaders;

      console.log(`Successfully initialized ${this.sheetName} sheet with headers`);
    } catch (error) {
      console.error(`Failed to create ${this.sheetName} sheet:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to create ${this.sheetName} sheet: ${errorMessage}`);
    }
  }

  /**
   * Get all issues
   */
  async getAll(): Promise<Issue[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.cache.values());
  }

  /**
   * Find an issue by its ID
   */
  async getById(id: string): Promise<Issue | null> {
    await this.refreshCacheIfNeeded();
    return this.cache.get(id) || null;
  }

  /**
   * Find issues by newsletter ID
   */
  async getByNewsletterId(newsletterId: string): Promise<Issue[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.cache.values()).filter((issue) => issue.newsletterId === newsletterId);
  }

  /**
   * Find issues by message ID (email message ID)
   */
  async getByMessageId(messageId: string): Promise<Issue | null> {
    await this.refreshCacheIfNeeded();

    for (const issue of this.cache.values()) {
      if (issue.messageId === messageId) {
        return issue;
      }
    }

    return null;
  }

  /**
   * Get unprocessed issues
   */
  async getUnprocessed(): Promise<Issue[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.cache.values()).filter((issue) => !issue.processed);
  }

  /**
   * Save an issue (create or update)
   */
  async save(issue: Issue): Promise<void> {
    await this.ensureInitialized();

    const data = await this.sheetsClient.getSheetData(this.sheetName);
    const idIndex = getColumnIndex(this.headerRow, 'ID');

    // Check if issue already exists
    let existingRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > idIndex && row[idIndex] === issue.id) {
        existingRowIndex = i;
        break;
      }
    }

    const newRow = this.issueToRow(issue);

    if (existingRowIndex !== -1) {
      // Update existing row
      await this.sheetsClient.updateSheetData(
        this.sheetName,
        `A${existingRowIndex + 1}:G${existingRowIndex + 1}`,
        [newRow],
      );
    } else {
      // Append new row
      await this.sheetsClient.appendSheetData(this.sheetName, [newRow]);
    }

    // Update cache
    this.cache.set(issue.id, issue);
  }

  /**
   * Delete an issue
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    const data = await this.sheetsClient.getSheetData(this.sheetName);
    const idIndex = getColumnIndex(this.headerRow, 'ID');

    const filteredData = data.filter((row, index) => {
      // Keep header row and rows that don't match the ID
      return index === 0 || row[idIndex] !== id;
    });

    // If we didn't filter anything out, the issue doesn't exist
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
   * Mark an issue as processed
   */
  async markAsProcessed(id: string): Promise<void> {
    const issue = await this.getById(id);
    if (!issue) {
      throw new Error(`Issue with ID ${id} not found`);
    }

    const processed = issue.markAsProcessed();
    await this.save(processed);
  }

  /**
   * Check if an issue exists by message ID
   */
  async existsByMessageId(messageId: string): Promise<boolean> {
    const issue = await this.getByMessageId(messageId);
    return issue !== null;
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
   * Refresh the issue cache from Google Sheets
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
          const issue = this.rowToIssue(row);
          this.cache.set(issue.id, issue);
        } catch (error) {
          console.error(`Error parsing issue row ${i + 1}:`, error);
          // Continue with other rows
        }
      }
    }

    this.lastCacheUpdate = Date.now();
  }

  /**
   * Convert a row from Google Sheets to an Issue entity
   */
  private rowToIssue(row: string[]): Issue {
    const obj = mapRowToObject(row, this.headerRow);

    return Issue.create({
      id: obj.ID,
      newsletterId: obj.NewsletterID,
      title: obj.Title,
      webUrl: obj.WebURL,
      receivedAt: new Date(obj.ReceivedAt),
      messageId: obj.MessageID || undefined,
      processed: obj.Processed === 'true',
    });
  }

  /**
   * Convert an Issue entity to a row for Google Sheets
   */
  private issueToRow(issue: Issue): string[] {
    const row: string[] = [];

    // Ensure columns are in the right order
    this.headerRow.forEach((header) => {
      switch (header) {
        case 'ID':
          row.push(issue.id);
          break;
        case 'NewsletterID':
          row.push(issue.newsletterId);
          break;
        case 'Title':
          row.push(issue.title);
          break;
        case 'WebURL':
          row.push(issue.webUrl);
          break;
        case 'ReceivedAt':
          row.push(issue.receivedAt.toISOString());
          break;
        case 'MessageID':
          row.push(issue.messageId || '');
          break;
        case 'Processed':
          row.push(issue.processed ? 'true' : 'false');
          break;
        default:
          row.push(''); // For any unknown columns
      }
    });

    return row;
  }
}
