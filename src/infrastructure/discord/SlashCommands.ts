import { EmbedBuilder, SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { HandleDiscordCommandsUseCase } from '../../application/usecases/HandleDiscordCommandsUseCase';
import { RepositoryFactory } from '../factories/repositoryFactory';
import { Colors } from 'discord.js';

export interface SlashCommand {
  data: SlashCommandBuilder;
  execute: (interaction: any) => Promise<void>;
}

export class SlashCommandManager {
  private commands: SlashCommand[] = [];
  private rest: REST;
  private clientId: string;
  private token: string;
  private commandUseCase: HandleDiscordCommandsUseCase | null = null;

  constructor(token: string, clientId: string) {
    this.token = token;
    this.clientId = clientId;
    this.rest = new REST({ version: '9' }).setToken(token);

    // Initialize commands
    this.registerCommands();
  }

  private async getCommandUseCase(): Promise<HandleDiscordCommandsUseCase> {
    if (!this.commandUseCase) {
      const guildSubscriptionRepository = await RepositoryFactory.getGuildSubscriptionRepository();
      const newsletterRepository = await RepositoryFactory.getNewsletterRepository();

      this.commandUseCase = new HandleDiscordCommandsUseCase(
        guildSubscriptionRepository,
        newsletterRepository,
      );
    }

    return this.commandUseCase;
  }
  /**
   * Register built-in commands
   */
  private registerCommands(): void {
    // List command - shows all subscribed newsletters
    const listCommand = {
      data: new SlashCommandBuilder()
        .setName('newsletters')
        .setDescription('List all newsletter subscriptions for this channel'),
      execute: async (interaction: any) => {
        await interaction.deferReply();

        try {
          const useCase = await this.getCommandUseCase();
          const result = await useCase.listNewsletters(interaction.guildId, interaction.channelId);

          if (result.subscriptions.length === 0) {
            await interaction.editReply('This channel is not subscribed to any newsletters.');
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle('Newsletter Subscriptions')
            .setDescription('This channel is subscribed to the following newsletters:')
            .setColor(Colors.Blue);

          result.subscriptions.forEach((sub) => {
            embed.addFields({
              name: sub.newsletterName,
              value: `ID: ${sub.newsletterId}`,
            });
          });

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          console.error('Error listing newsletters:', error);
          await interaction.editReply('An error occurred while fetching subscriptions.');
        }
      },
    };

    // Subscribe command - subscribe a channel to a newsletter
    const subscribeCommand = {
      data: new SlashCommandBuilder()
        .setName('subscribe')
        .setDescription('Subscribe this channel to a newsletter')
        .addStringOption((option) =>
          option
            .setName('newsletter')
            .setDescription('The newsletter to subscribe to')
            .setRequired(true)
            .setAutocomplete(true),
        ),
      execute: async (interaction: any) => {
        await interaction.deferReply();

        try {
          const useCase = await this.getCommandUseCase();
          const newsletterId = interaction.options.getString('newsletter');

          const result = await useCase.subscribeToNewsletter(
            interaction.guildId,
            interaction.channelId,
            newsletterId,
          );

          if (result.success) {
            const embed = new EmbedBuilder()
              .setTitle('Subscription Added')
              .setDescription(result.message)
              .setColor(Colors.Green);

            await interaction.editReply({ embeds: [embed] });
          } else {
            const embed = new EmbedBuilder()
              .setTitle('Subscription Failed')
              .setDescription(result.message)
              .setColor(Colors.Red);

            await interaction.editReply({ embeds: [embed] });
          }
        } catch (error) {
          console.error('Error subscribing to newsletter:', error);
          await interaction.editReply('An error occurred while subscribing.');
        }
      },
    };
    // Unsubscribe command - unsubscribe a channel from a newsletter
    const unsubscribeCommand = {
      data: new SlashCommandBuilder()
        .setName('unsubscribe')
        .setDescription('Unsubscribe this channel from a newsletter')
        .addStringOption((option) =>
          option
            .setName('newsletter')
            .setDescription('The newsletter to unsubscribe from')
            .setRequired(true)
            .setAutocomplete(true),
        ),
      execute: async (interaction: any) => {
        await interaction.deferReply();

        try {
          const useCase = await this.getCommandUseCase();
          const newsletterId = interaction.options.getString('newsletter');

          const result = await useCase.unsubscribeFromNewsletter(
            interaction.guildId,
            interaction.channelId,
            newsletterId,
          );

          if (result.success) {
            const embed = new EmbedBuilder()
              .setTitle('Unsubscribed')
              .setDescription(result.message)
              .setColor(Colors.Green);

            await interaction.editReply({ embeds: [embed] });
          } else {
            const embed = new EmbedBuilder()
              .setTitle('Unsubscribe Failed')
              .setDescription(result.message)
              .setColor(Colors.Red);

            await interaction.editReply({ embeds: [embed] });
          }
        } catch (error) {
          console.error('Error unsubscribing from newsletter:', error);
          await interaction.editReply('An error occurred while unsubscribing.');
        }
      },
    };

    this.commands.push(listCommand as SlashCommand);
    this.commands.push(subscribeCommand as SlashCommand);
    this.commands.push(unsubscribeCommand as SlashCommand);
  }

  /**
   * Deploy commands to Discord
   */
  async deployCommands(guildId?: string): Promise<void> {
    try {
      const commandData = this.commands.map((command) => command.data.toJSON());

      // Log what we're about to deploy
      console.log(
        `Preparing to deploy ${commandData.length} commands: ${commandData.map((c) => c.name).join(', ')}`,
      );

      if (guildId) {
        // Guild-specific deployment (faster for testing)
        console.log(`Started refreshing application (/) commands for guild ${guildId}`);
        await this.rest.put(Routes.applicationGuildCommands(this.clientId, guildId), {
          body: commandData,
        });
        console.log(`Successfully reloaded application (/) commands for guild ${guildId}`);
      } else {
        // Global deployment (can take up to an hour to propagate)
        console.log('Started refreshing application (/) commands globally');
        await this.rest.put(Routes.applicationCommands(this.clientId), { body: commandData });
        console.log('Successfully reloaded application (/) commands globally');
      }
    } catch (error) {
      console.error('Error deploying commands:', error);
      throw error; // Rethrow to handle in the calling function
    }
  }

  /**
   * Handle an interaction (slash command)
   */
  async handleInteraction(interaction: any): Promise<void> {
    if (!interaction.isCommand()) return;

    const command = this.commands.find((cmd) => cmd.data.name === interaction.commandName);

    if (!command) {
      console.error(`Command not found: ${interaction.commandName}`);
      return;
    }

    try {
      console.log(`Executing command: ${interaction.commandName}`);
      await command.execute(interaction);
      console.log(`Command executed successfully: ${interaction.commandName}`);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);

      // Only try to reply if the interaction hasn't been replied to already
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'There was an error executing this command.',
            ephemeral: true,
          });
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply('There was an error executing this command.');
        }
      } catch (e) {
        console.error('Error sending error message:', e);
      }
    }
  }

  /**
   * Get the list of registered commands
   */
  getCommands(): SlashCommand[] {
    return this.commands;
  }
}
