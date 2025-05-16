import { RepositoryFactory } from '../infrastructure/factories/repositoryFactory';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function processNewsletters() {
  try {
    console.log('Starting manual newsletter processing...');

    // Get the use case from the factory
    const pullInboxUseCase = await RepositoryFactory.getPullInboxUseCase();

    console.log('Fetching and processing emails...');

    // Execute the use case
    const result = await pullInboxUseCase.execute();

    // Display results
    console.log('===================== EMAIL PROCESSING RESULTS =====================');
    console.log(`Total emails checked: ${result.totalEmails}`);
    console.log(`Matched newsletters: ${result.matchedNewsletters}`);
    console.log(`Issues extracted: ${result.extractedIssues}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.extractedIssues > 0) {
      console.log('\nSUCCESSFUL ISSUES:');
      // Since we don't have the actual issues here, we'd need to fetch them
      // This is simplified output
      console.log(`  Extracted ${result.extractedIssues} issues successfully`);
    }

    if (result.errors.length > 0) {
      console.log('\nERRORS:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.subject}: ${error.error}`);
      });
    }

    console.log('\n=================================================================');

    return result.extractedIssues > 0;
  } catch (error) {
    console.error('Error processing newsletters:', error);
    return false;
  }
}

// Run the script
processNewsletters()
  .then((foundIssues) => {
    console.log(
      foundIssues
        ? 'Newsletter processing completed successfully with found issues!'
        : 'Newsletter processing completed with no issues found.',
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error during newsletter processing:', error);
    process.exit(1);
  });
