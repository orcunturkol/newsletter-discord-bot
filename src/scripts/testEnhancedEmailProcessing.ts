import { RepositoryFactory } from '../infrastructure/factories/repositoryFactory';
import { EmailProcessorService } from '../application/services/EmailProcessorService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEnhancedEmailProcessing() {
  try {
    console.log('Starting enhanced email processing test...');

    // Get dependencies
    const mailService = RepositoryFactory.getMailService();
    const newsletterRepository = await RepositoryFactory.getNewsletterRepository();

    // Create email processor service
    const emailProcessor = new EmailProcessorService(mailService, newsletterRepository);

    console.log('Fetching and processing emails...');

    // Process emails
    const results = await emailProcessor.processNewEmails();

    // Display results
    console.log(emailProcessor.getResultsOutput(results));

    console.log('Enhanced email processing test completed!');
  } catch (error) {
    console.error('Error during enhanced email processing test:', error);
  }
}

testEnhancedEmailProcessing();
