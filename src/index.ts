import { RepositoryFactory } from './infrastructure/factories/repositoryFactory';
import { CronJob } from 'cron';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('Starting Newsletter-to-Discord Bot...');

    // Initialize Discord client
    const discordClient = await RepositoryFactory.getDiscordClient();
    console.log('Discord client initialized');

    // Set up cron job for checking newsletters
    const checkNewslettersJob = new CronJob(
      '*/1 * * * *',
      async () => {
        console.log('Running scheduled newsletter check...');
        try {
          // Pull new emails
          const pullInboxUseCase = await RepositoryFactory.getPullInboxUseCase();
          const pullResult = await pullInboxUseCase.execute();
          console.log(
            `Processed ${pullResult.totalEmails} emails, found ${pullResult.extractedIssues} new issues`,
          );

          // Dispatch issues to Discord
          if (pullResult.extractedIssues > 0) {
            console.log('Dispatching issues to Discord...');
            const dispatchUseCase = await RepositoryFactory.getDispatchIssueUseCase();

            // Check for unprocessed issues
            const issueRepo = await RepositoryFactory.getIssueRepository();
            const unprocessedIssues = await issueRepo.getUnprocessed();
            console.log(`Found ${unprocessedIssues.length} unprocessed issues to dispatch`);

            // Check subscriptions for each issue
            for (const issue of unprocessedIssues) {
              const subRepo = await RepositoryFactory.getGuildSubscriptionRepository();
              const subs = await subRepo.getActiveByNewsletterId(issue.newsletterId);
              console.log(
                `Newsletter ${issue.newsletterId} has ${subs.length} active subscriptions`,
              );
            }

            const dispatchResult = await dispatchUseCase.dispatchUnprocessedIssues();
            console.log(`Dispatch result:`, dispatchResult);
            console.log(
              `Dispatched ${dispatchResult.successfulIssues} issues to Discord (${dispatchResult.totalChannels} channels)`,
            );

            if (dispatchResult.errors.length > 0) {
              console.error('Dispatch errors:', dispatchResult.errors);
            }
          } else {
            console.log('No new issues to dispatch');
          }
        } catch (error) {
          console.error('Error in scheduled newsletter check:', error);
        }
      },
      null,
      true, // Start the job right away
      'America/New_York', // Timezone
    );

    console.log('Scheduled newsletter check job started');

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      checkNewslettersJob.stop();
      process.exit(0);
    });

    // Keep the process running
    console.log('Bot is now running. Press Ctrl+C to exit.');
  } catch (error) {
    console.error('Error starting bot:', error);
    process.exit(1);
  }
}

// Run the main function
main();
