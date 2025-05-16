// src/scripts/debugEmailSenders.ts

import { RepositoryFactory } from '../infrastructure/factories/repositoryFactory';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function debugEmailSenders() {
  try {
    console.log('Starting email sender debugging...');

    // Get mail service
    const mailService = RepositoryFactory.getMailService();

    // Connect to email
    console.log('Connecting to mail server...');
    await mailService.connect();

    // Fetch emails
    console.log('Fetching emails...');
    const emails = await mailService.fetchNewEmails();
    console.log(`Found ${emails.length} emails`);

    // Get newsletter repository
    const newsletterRepository = await RepositoryFactory.getNewsletterRepository();

    // Get all newsletters for reference
    const allNewsletters = await newsletterRepository.getAll();
    console.log(`Loaded ${allNewsletters.length} newsletters from Google Sheets`);
    console.log('Newsletter emails in database:');
    allNewsletters.forEach((n) => {
      console.log(`- "${n.name}": "${n.senderEmail}"`);
    });

    // Process each email
    console.log('\nAnalyzing emails:');

    for (const email of emails) {
      console.log('\n========================================');
      console.log(`Email subject: "${email.subject}"`);

      // Extract the raw sender
      console.log(`Raw sender: "${email.from}"`);

      // Extract domain from email
      const fromMatch = email.from.match(/<?([\w.-]+@[\w.-]+)>?/);
      const fromEmail = fromMatch ? fromMatch[1] : email.from;
      console.log(`Extracted sender email: "${fromEmail}"`);

      // Check for match in database
      const matchingNewsletter = await newsletterRepository.getBySenderEmail(fromEmail);
      if (matchingNewsletter) {
        console.log(`✅ MATCHED with newsletter: "${matchingNewsletter.name}"`);
      } else {
        console.log('❌ NO MATCH in database');

        // Try to help find close matches
        const domain = fromEmail.split('@')[1];
        if (domain) {
          console.log(`Looking for close matches with domain: ${domain}`);

          // Find similar domain newsletters manually
          const domainMatches = allNewsletters.filter((n) =>
            n.senderEmail.toLowerCase().endsWith('@' + domain.toLowerCase()),
          );

          if (domainMatches.length > 0) {
            console.log('Found similar domain newsletters:');
            domainMatches.forEach((n) => {
              console.log(`- "${n.name}": "${n.senderEmail}"`);
            });
          } else {
            console.log('No similar domain newsletters found');
          }
        }
      }

      console.log('========================================');
    }

    // Disconnect
    await mailService.disconnect();
    console.log('\nEmail debugging completed');
  } catch (error) {
    console.error('Error during email debugging:', error);
  }
}

debugEmailSenders();
