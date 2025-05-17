import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function cleanupCommands() {
  try {
    // Extract client ID correctly
    let clientId = process.env.DISCORD_CLIENT_ID || '';
    // Extract just the client ID if it's a full URL
    if (clientId.includes('client_id=')) {
      const match = clientId.match(/client_id=(\d+)/);
      if (match && match[1]) {
        clientId = match[1];
      }
    }

    const token = process.env.DISCORD_BOT_TOKEN || '';

    if (!clientId || !token) {
      throw new Error('Missing client ID or token in environment variables');
    }

    console.log(`Cleaning up commands for application ID: ${clientId}`);

    const rest = new REST({ version: '9' }).setToken(token);

    // Delete all global commands
    console.log('Deleting all global commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: [] });

    // If you want to delete commands from a specific guild too
    // const guildId = 'YOUR_GUILD_ID';
    // console.log(`Deleting all commands from guild ${guildId}...`);
    // await rest.put(
    //   Routes.applicationGuildCommands(clientId, guildId),
    //   { body: [] }
    // );

    console.log('All commands deleted successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning up commands:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupCommands();
