import { RepositoryFactory } from '../infrastructure/factories/repositoryFactory';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function deployCommands() {
  try {
    console.log('Deploying slash commands...');

    // Get Discord client
    const discordClient = await RepositoryFactory.getDiscordClient();

    // Deploy to a specific guild for testing
    // Replace with your test guild ID
    const testGuildId = process.env.TEST_GUILD_ID;

    if (testGuildId) {
      await discordClient.deployCommandsToGuild(testGuildId);
      console.log(`Commands deployed to guild ${testGuildId}`);
    } else {
      console.log('No TEST_GUILD_ID found in environment variables. Skipping guild deployment.');

      // Uncomment to deploy globally (use with caution, rate limits apply)
      // await discordClient.deployCommands();
      // console.log('Commands deployed globally');
    }

    console.log('Command deployment completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error deploying commands:', error);
    process.exit(1);
  }
}

deployCommands();
