import { RepositoryFactory } from '../infrastructure/factories/repositoryFactory';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function dispatchIssues() {
  try {
    console.log('Starting issue dispatch process...');

    // Get the use case
    const dispatchUseCase = await RepositoryFactory.getDispatchIssueUseCase();

    // Dispatch all unprocessed issues
    const result = await dispatchUseCase.dispatchUnprocessedIssues();

    // Display results
    console.log('===================== DISPATCH RESULTS =====================');
    console.log(`Total issues processed: ${result.totalIssues}`);
    console.log(`Successfully dispatched: ${result.successfulIssues}`);
    console.log(`Failed to dispatch: ${result.failedIssues}`);
    console.log(`Total channels posted to: ${result.totalChannels}`);

    if (result.errors.length > 0) {
      console.log('\nERRORS:');
      result.errors.forEach((error, index) => {
        console.log(
          `  ${index + 1}. Issue ${error.issueId} to channel ${error.channelId}: ${error.error}`,
        );
      });
    }

    console.log('\n=================================================================');

    return result.successfulIssues > 0;
  } catch (error) {
    console.error('Error dispatching issues:', error);
    return false;
  }
}

// Run the script
dispatchIssues()
  .then((success) => {
    console.log(
      success
        ? 'Issue dispatch completed successfully!'
        : 'Issue dispatch completed with no successful dispatches.',
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error during issue dispatch:', error);
    process.exit(1);
  });
