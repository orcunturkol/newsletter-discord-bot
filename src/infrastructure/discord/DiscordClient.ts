import {
  Client,
  GatewayIntentBits,
  TextChannel,
  EmbedBuilder,
  GuildChannel,
  ChannelType,
  Collection,
  Message,
  Colors,
  REST,
  Routes,
  APIEmbed,
  Interaction,
} from 'discord.js';
import { SlashCommandManager } from './SlashCommands';
import { HandleDiscordCommandsUseCase } from '../../application/usecases/HandleDiscordCommandsUseCase';
import { RepositoryFactory } from '../factories/repositoryFactory';
interface PostOptions {
  channelId: string;
  title: string;
  url: string;
  description?: string;
  color?: number;
  timestamp?: Date;
  footer?: string;
  thumbnailUrl?: string;
}

export class DiscordClient {
  private client: Client;
  private token: string;
  private clientId: string;
  private isReady: boolean = false;
  private rateLimitQueue: Map<string, PostOptions[]> = new Map();
  private processingQueue: boolean = false;
  private commandManager: SlashCommandManager;
  private commandUseCase: HandleDiscordCommandsUseCase | null = null;

  constructor(token: string, clientId: string) {
    this.token = token;
    this.clientId = clientId;

    // Initialize Discord client with necessary intents
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    // Initialize command manager
    this.commandManager = new SlashCommandManager(token, clientId);

    // Set up event handlers
    this.setupEventHandlers();
  }
  private async getCommandUseCase(): Promise<HandleDiscordCommandsUseCase> {
    if (!this.commandUseCase) {
      this.commandUseCase = await RepositoryFactory.getHandleDiscordCommandsUseCase();
    }
    return this.commandUseCase;
  }
  /**
   * Initialize the Discord client and connect to Discord
   */
  async initialize(): Promise<void> {
    if (!this.token) {
      throw new Error('Discord bot token is required');
    }

    try {
      // Log in to Discord
      await this.client.login(this.token);
      console.log('Discord client initialized and logged in');

      // Deploy commands globally (comment this out for testing to avoid rate limits)
      await this.commandManager.deployCommands();
    } catch (error) {
      console.error('Failed to initialize Discord client:', error);
      throw error;
    }
  }

  /**
   * Deploy commands to a specific guild (for testing)
   */
  async deployCommandsToGuild(guildId: string): Promise<void> {
    await this.commandManager.deployCommands(guildId);
  }

  /**
   * Set up event handlers for the Discord client
   */
  private setupEventHandlers(): void {
    // Ready event - fires when the bot connects to Discord
    this.client.once('ready', () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
      this.isReady = true;
    });

    // Error event - fires on connection errors
    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
      this.isReady = false;
    });

    // Reconnecting event - fires when the bot tries to reconnect
    this.client.on('reconnecting', () => {
      console.log('Discord client reconnecting...');
      this.isReady = false;
    });

    // Resumed event - fires when the bot reconnects successfully
    this.client.on('resumed', () => {
      console.log('Discord client resumed connection');
      this.isReady = true;
    });

    // Guild join event - fires when the bot joins a new server
    this.client.on('guildCreate', (guild) => {
      console.log(`Bot joined a new guild: ${guild.name} (${guild.id})`);
      // Deploy commands to the new guild
      this.deployCommandsToGuild(guild.id).catch((error) =>
        console.error(`Failed to deploy commands to guild ${guild.id}:`, error),
      );
    });

    // Guild leave event - fires when the bot leaves a server
    this.client.on('guildDelete', (guild) => {
      console.log(`Bot left a guild: ${guild.name} (${guild.id})`);
    });

    // Interaction event - fires when a user uses a slash command
    this.client.on('interactionCreate', async (interaction: Interaction) => {
      console.log(`Received interaction type: ${interaction.type}`);

      if (interaction.isCommand()) {
        console.log(`Handling command: ${interaction.commandName}`);
        await this.commandManager.handleInteraction(interaction);
      } else if (interaction.isAutocomplete()) {
        console.log(`Handling autocomplete for: ${interaction.commandName}`);
        await this.handleAutocomplete(interaction);
      }
    });
  }

  private async handleAutocomplete(interaction: any): Promise<void> {
    if (!interaction.isAutocomplete()) return;

    try {
      if (interaction.commandName === 'subscribe') {
        await this.handleNewsletterAutocomplete(interaction);
      } else if (interaction.commandName === 'unsubscribe') {
        await this.handleSubscribedNewsletterAutocomplete(interaction);
      }
    } catch (error) {
      console.error('Error handling autocomplete:', error);
    }
  }
  private async handleNewsletterAutocomplete(interaction: any): Promise<void> {
    try {
      const useCase = await this.getCommandUseCase();
      const newsletters = await useCase.getAvailableNewsletters();

      const focusedValue = interaction.options.getFocused().toLowerCase();
      const filtered = newsletters
        .filter((newsletter) => newsletter.name.toLowerCase().includes(focusedValue))
        .slice(0, 25); // Discord has a limit of 25 choices

      await interaction.respond(
        filtered.map((newsletter) => ({
          name: newsletter.name,
          value: newsletter.id,
        })),
      );
    } catch (error) {
      console.error('Error handling newsletter autocomplete:', error);
      await interaction.respond([]);
    }
  }

  private async handleSubscribedNewsletterAutocomplete(interaction: any): Promise<void> {
    try {
      const useCase = await this.getCommandUseCase();
      const result = await useCase.listNewsletters(interaction.guildId, interaction.channelId);

      const focusedValue = interaction.options.getFocused().toLowerCase();
      const filtered = result.subscriptions
        .filter((sub) => sub.newsletterName.toLowerCase().includes(focusedValue))
        .slice(0, 25); // Discord has a limit of 25 choices

      await interaction.respond(
        filtered.map((sub) => ({
          name: sub.newsletterName,
          value: sub.newsletterId,
        })),
      );
    } catch (error) {
      console.error('Error handling subscribed newsletter autocomplete:', error);
      await interaction.respond([]);
    }
  }

  /**
   * Post a newsletter to a Discord channel
   */
  async postToChannel(options: PostOptions): Promise<void> {
    if (!this.isReady) {
      throw new Error('Discord client is not ready. Call initialize() first');
    }

    // Add to rate limit queue for the channel
    if (!this.rateLimitQueue.has(options.channelId)) {
      this.rateLimitQueue.set(options.channelId, []);
    }

    this.rateLimitQueue.get(options.channelId)?.push(options);

    // Start queue processing if not already running
    if (!this.processingQueue) {
      this.processRateLimitQueue();
    }
  }

  /**
   * Process the rate limit queue to avoid hitting Discord rate limits
   */
  private async processRateLimitQueue(): Promise<void> {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    try {
      // Process each channel queue
      for (const [channelId, queue] of this.rateLimitQueue.entries()) {
        if (queue.length === 0) {
          continue;
        }

        // Get the next item from the queue
        const postOptions = queue.shift();
        if (!postOptions) {
          continue;
        }

        try {
          await this.sendMessageToChannel(postOptions);

          // Rate limit: Wait 1 second between messages to same channel
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error posting to channel ${channelId}:`, error);

          if (this.isRateLimitError(error)) {
            // If rate limited, push back to front of queue and wait
            queue.unshift(postOptions);
            const retryAfter = this.getRetryAfterTime(error) || 5000;
            console.log(`Rate limited. Retrying after ${retryAfter}ms`);
            await new Promise((resolve) => setTimeout(resolve, retryAfter));
          }
        }
      }
    } finally {
      // Clean up empty queues
      for (const [channelId, queue] of this.rateLimitQueue.entries()) {
        if (queue.length === 0) {
          this.rateLimitQueue.delete(channelId);
        }
      }

      // If there are still items in the queue, continue processing
      if (this.rateLimitQueue.size > 0) {
        setTimeout(() => this.processRateLimitQueue(), 100);
      } else {
        this.processingQueue = false;
      }
    }
  }

  /**
   * Send an actual message to a Discord channel
   */
  private async sendMessageToChannel(options: PostOptions): Promise<void> {
    try {
      // Try to fetch the channel
      const channel = await this.client.channels.fetch(options.channelId);

      if (!channel || channel.type !== ChannelType.GuildText) {
        throw new Error(`Channel ${options.channelId} is not a text channel`);
      }

      const textChannel = channel as TextChannel;

      // Create the embed
      const embed = new EmbedBuilder()
        .setTitle(options.title)
        .setURL(options.url)
        .setColor(options.color || Colors.Blue)
        .setTimestamp(options.timestamp || new Date());

      if (options.description) {
        embed.setDescription(options.description);
      }

      if (options.footer) {
        embed.setFooter({ text: options.footer });
      }

      if (options.thumbnailUrl) {
        embed.setThumbnail(options.thumbnailUrl);
      }

      // Send the message
      await textChannel.send({ embeds: [embed] });
      console.log(`Posted newsletter to channel ${options.channelId}`);
    } catch (error) {
      console.error(`Error sending message to channel ${options.channelId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a guild (server) exists
   */
  async guildExists(guildId: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      return !!guild;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a channel exists in a guild
   */
  async channelExists(guildId: string, channelId: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      return !!channel;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available text channels in a guild
   */
  async getGuildTextChannels(guildId: string): Promise<{ id: string; name: string }[]> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const channels = await guild.channels.fetch();

      return channels
        .filter((channel) => channel?.type === ChannelType.GuildText)
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
        }));
    } catch (error) {
      console.error(`Error fetching channels for guild ${guildId}:`, error);
      return [];
    }
  }

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    return error.httpStatus === 429 || (error.message && error.message.includes('rate limit'));
  }

  /**
   * Extract retry-after time from a rate limit error
   */
  private getRetryAfterTime(error: any): number | null {
    if (error.httpStatus === 429 && error.retryAfter) {
      return error.retryAfter * 1000; // Convert to ms
    }
    return null;
  }
}
