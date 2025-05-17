import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const discordConfig = {
  botToken: process.env.DISCORD_BOT_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  guildId: process.env.DISCORD_GUILD_ID || '', // For testing or specific guild commands
};

// Validate the configuration
export function validateDiscordConfig(): void {
  if (!discordConfig.botToken) {
    throw new Error('DISCORD_BOT_TOKEN is required in .env file');
  }

  if (!discordConfig.clientId) {
    throw new Error('DISCORD_CLIENT_ID is required in .env file');
  }
}

// Validate on import
validateDiscordConfig();

export default discordConfig;
