import { RepositoryFactory } from '../infrastructure/factories/repositoryFactory';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmailService() {
  try {
    const mailService = RepositoryFactory.getMailService();

    console.log('Connecting to mail server...');
    await mailService.connect();
    console.log('Connected successfully');

    console.log('Fetching new emails...');
    const emails = await mailService.fetchNewEmails();
    console.log(`Found ${emails.length} new emails`);

    if (emails.length > 0) {
      // Display email information
      emails.forEach((email, index: number) => {
        console.log(`\nEmail #${index + 1}:`);
        console.log(`From: ${email.from}`);
        console.log(`Subject: ${email.subject}`);
        console.log(`Received: ${email.receivedAt}`);
        console.log(`MessageID: ${email.messageId}`);
        console.log(`Has HTML: ${email.html ? 'Yes' : 'No'}`);
        console.log(`Body preview: ${email.body.substring(0, 100)}...`);

        // Mark the first email as processed for testing
        if (index === 0 && email.messageId) {
          console.log(`\nMarking email #${index + 1} as processed...`);
          mailService
            .markAsProcessed(email.messageId)
            .then(() => console.log('Email marked as processed'))
            .catch((err: any) => console.error('Error marking email as processed:', err));
        }
      });
    }

    console.log('\nDisconnecting from mail server...');
    await mailService.disconnect();
    console.log('Disconnected successfully');

    console.log('\nEmail service test completed successfully!');
  } catch (error) {
    console.error('Email service test failed:', error);
  }
}

testEmailService();
