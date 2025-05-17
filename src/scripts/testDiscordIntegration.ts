import { RepositoryFactory } from '../infrastructure/factories/repositoryFactory';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testDiscordIntegration() {
  try {
    console.log('Testing Discord integration...');

    // Get Discord client
    const discordClient = await RepositoryFactory.getDiscordClient();
    console.log('Discord client initialized');

    // Test sending a message - uncomment and update with a real channel ID to test
    // const testChannelId = '1234567890123456789'; // Replace with a real channel ID
    // await discordClient.postToChannel({
    //   channelId: testChannelId,
    //   title: 'Test Newsletter',
    //   url: 'https://example.com',
    //   description: 'This is a test message from the Newsletter Bot',
    //   footer: 'Test Footer',
    //   timestamp: new Date()
    // });
    // console.log('Test message sent successfully');

    console.log('Discord integration test completed successfully!');
  } catch (error) {
    console.error('Discord integration test failed:', error);
  }
}

testDiscordIntegration();
