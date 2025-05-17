import dotenv from 'dotenv';
import { RepositoryFactory } from '../infrastructure/factories/repositoryFactory';

dotenv.config();

async function checkSubscriptions() {
  try {
    console.log('Checking newsletter subscriptions...');

    // Get all newsletters
    const newsletterRepo = await RepositoryFactory.getNewsletterRepository();
    const newsletters = await newsletterRepo.getAll();
    console.log(`Found ${newsletters.length} newsletters in total`);

    // Check subscriptions for each newsletter
    const subRepo = await RepositoryFactory.getGuildSubscriptionRepository();

    for (const newsletter of newsletters) {
      const subs = await subRepo.getActiveByNewsletterId(newsletter.id);
      console.log(
        `Newsletter "${newsletter.name}" (${newsletter.id}): ${subs.length} active subscriptions`,
      );

      if (subs.length > 0) {
        // Check if the Discord channels still exist
        const discordClient = await RepositoryFactory.getDiscordClient();
        for (const sub of subs) {
          try {
            console.log(`  → Guild: ${sub.guildId}, Channel: ${sub.channelId}`);
            const exists = await discordClient.channelExists(sub.guildId, sub.channelId);
            console.log(`  → Channel exists: ${exists}`);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`  → Error checking channel: ${errorMessage}`);
          }
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error checking subscriptions:', error);
    process.exit(1);
  }
}

checkSubscriptions();
