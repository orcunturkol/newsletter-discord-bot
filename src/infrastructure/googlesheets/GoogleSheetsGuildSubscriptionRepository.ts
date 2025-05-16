import { IGuildSubscriptionRepository } from '../../application/ports/IGuildSubscriptionRepository';
import { GuildSubscription } from '../../domain/entities/GuildSubscription';
import { GoogleSheetsClient } from './GoogleSheetsClient';
import {
  validateSheetHeaders,
  mapRowToObject,
  getColumnIndex,
} from '../../shared/utils/sheetValidator';

export class GoogleSheetsGuildSubscriptionRepository implements IGuildSubscriptionRepository {
  private readonly sheetName = 'GuildSubscriptions';
  private readonly requiredHeaders = ['ID', 'GuildID', 'ChannelID', 'NewsletterID', 'Active'];
  private headerRow: string[] = [];
  private cache: Map<string, GuildSubscription> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly cacheTTL = 60000; // 1 minute cache TTL

  constructor(private readonly sheetsClient: GoogleSheetsClient) {}

  /**
   * Initialize the repository by validating the sheet structure
   */
  async initialize(): Promise<void> {
    try {
      const data = await this.sheetsClient.getSheetData(this.sheetName);

      if (!data || data.length === 0) {
        throw new Error(`Sheet "${this.sheetName}" is empty or does not exist`);
      }

      this.headerRow = data[0].map(String);
      validateSheetHeaders(this.headerRow, this.requiredHeaders, this.sheetName);
    } catch (error) {
      // If sheet doesn't exist, create it
      if (
        error instanceof Error &&
        (error.message?.includes('not found') || error.message?.includes('does not exist'))
      ) {
        await this.createGuildSubscriptionsSheet();
      } else {
        throw error;
      }
    }
  }

  /**
   * Create the GuildSubscriptions sheet with required headers
   */
  private async createGuildSubscriptionsSheet(): Promise<void> {
    try {
      // Check if sheet exists first
      const sheets = await this.sheetsClient.getSheets();
      if (!sheets.includes(this.sheetName)) {
        await this.sheetsClient.createSheet(this.sheetName);
        console.log(`Created ${this.sheetName} sheet`);
      }

      // Add header row
      await this.sheetsClient.updateSheetData(this.sheetName, 'A1:E1', [this.requiredHeaders]);

      // Update headerRow
      this.headerRow = this.requiredHeaders;

      console.log(`Initialized ${this.sheetName} sheet with headers`);
    } catch (error) {
      console.error(`Failed to create ${this.sheetName} sheet:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to create ${this.sheetName} sheet: ${errorMessage}`);
    }
  }

  /**
   * Get all guild subscriptions
   */
  async getAll(): Promise<GuildSubscription[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.cache.values());
  }

  /**
   * Find a subscription by its ID
   */
  async getById(id: string): Promise<GuildSubscription | null> {
    await this.refreshCacheIfNeeded();
    return this.cache.get(id) || null;
  }

  /**
   * Find subscriptions by guild ID
   */
  async getByGuildId(guildId: string): Promise<GuildSubscription[]> {
    if (!guildId) {
      throw new Error('Guild ID is required');
    }

    await this.refreshCacheIfNeeded();

    return Array.from(this.cache.values()).filter((sub) => sub.guildId === guildId);
  }

  /**
   * Find subscriptions by newsletter ID
   */
  async getByNewsletterId(newsletterId: string): Promise<GuildSubscription[]> {
    if (!newsletterId) {
      throw new Error('Newsletter ID is required');
    }

    await this.refreshCacheIfNeeded();

    return Array.from(this.cache.values()).filter((sub) => sub.newsletterId === newsletterId);
  }

  /**
   * Find active subscriptions by newsletter ID
   */
  async getActiveByNewsletterId(newsletterId: string): Promise<GuildSubscription[]> {
    if (!newsletterId) {
      throw new Error('Newsletter ID is required');
    }

    await this.refreshCacheIfNeeded();

    return Array.from(this.cache.values()).filter(
      (sub) => sub.newsletterId === newsletterId && sub.active,
    );
  }

  /**
   * Find subscription by guild ID and newsletter ID
   */
  async getByGuildAndNewsletter(
    guildId: string,
    newsletterId: string,
  ): Promise<GuildSubscription | null> {
    if (!guildId || !newsletterId) {
      throw new Error('Guild ID and Newsletter ID are required');
    }

    await this.refreshCacheIfNeeded();

    for (const subscription of this.cache.values()) {
      if (subscription.guildId === guildId && subscription.newsletterId === newsletterId) {
        return subscription;
      }
    }

    return null;
  }

  /**
   * Save a subscription (create or update)
   */
  async save(subscription: GuildSubscription): Promise<void> {
    await this.ensureInitialized();

    const data = await this.sheetsClient.getSheetData(this.sheetName);
    const idIndex = getColumnIndex(this.headerRow, 'ID');

    // Check if subscription already exists
    let existingRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > idIndex && row[idIndex] === subscription.id) {
        existingRowIndex = i;
        break;
      }
    }

    const newRow = this.subscriptionToRow(subscription);

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
    this.cache.set(subscription.id, subscription);
  }

  /**
   * Delete a subscription
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    const data = await this.sheetsClient.getSheetData(this.sheetName);
    const idIndex = getColumnIndex(this.headerRow, 'ID');

    const filteredData = data.filter((row, index) => {
      // Keep header row and rows that don't match the ID
      return index === 0 || row[idIndex] !== id;
    });

    // If we didn't filter anything out, the subscription doesn't exist
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
   * Delete all subscriptions for a guild
   */
  async deleteByGuildId(guildId: string): Promise<void> {
    if (!guildId) {
      throw new Error('Guild ID is required');
    }

    await this.refreshCacheIfNeeded();

    // Find all subscriptions for this guild
    const guildSubscriptions = await this.getByGuildId(guildId);

    // Delete each subscription
    for (const subscription of guildSubscriptions) {
      await this.delete(subscription.id);
    }
  }

  /**
   * Check if a subscription exists for a guild and newsletter
   */
  async existsByGuildAndNewsletter(guildId: string, newsletterId: string): Promise<boolean> {
    const subscription = await this.getByGuildAndNewsletter(guildId, newsletterId);
    return subscription !== null;
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
   * Refresh the subscription cache from Google Sheets
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
          const subscription = this.rowToSubscription(row);
          this.cache.set(subscription.id, subscription);
        } catch (error) {
          console.error(`Error parsing subscription row ${i + 1}:`, error);
          // Continue with other rows
        }
      }
    }

    this.lastCacheUpdate = Date.now();
  }

  /**
   * Convert a row from Google Sheets to a GuildSubscription entity
   */
  private rowToSubscription(row: string[]): GuildSubscription {
    const obj = mapRowToObject(row, this.headerRow);

    return GuildSubscription.create({
      id: obj.ID,
      guildId: obj.GuildID,
      channelId: obj.ChannelID,
      newsletterId: obj.NewsletterID,
      active: obj.Active === 'true', // Convert string to boolean
    });
  }

  /**
   * Convert a GuildSubscription entity to a row for Google Sheets
   */
  private subscriptionToRow(subscription: GuildSubscription): string[] {
    const row: string[] = [];

    // Ensure columns are in the right order
    this.headerRow.forEach((header) => {
      switch (header) {
        case 'ID':
          row.push(subscription.id);
          break;
        case 'GuildID':
          row.push(subscription.guildId);
          break;
        case 'ChannelID':
          row.push(subscription.channelId);
          break;
        case 'NewsletterID':
          row.push(subscription.newsletterId);
          break;
        case 'Active':
          row.push(subscription.active ? 'true' : 'false');
          break;
        default:
          row.push(''); // For any unknown columns
      }
    });

    return row;
  }
}
