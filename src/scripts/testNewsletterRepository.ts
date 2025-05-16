import { GoogleSheetsClient } from '../infrastructure/googlesheets/GoogleSheetsClient';
import { GoogleSheetsNewsletterRepository } from '../infrastructure/googlesheets/GoogleSheetsNewsletterRepository';
import { Newsletter } from '../domain/entities/Newsletter';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupTestSheet(sheetsClient: GoogleSheetsClient): Promise<void> {
  const sheetName = 'Sheet1';

  // Check if the sheet exists
  const sheets = await sheetsClient.getSheets();
  console.log('Available sheets:', sheets);
  if (!sheets.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" does not exist. Please create it manually.`);
  }

  // Check if we already have data
  const data = await sheetsClient.getSheetData(sheetName);

  // If empty or no header row, set up the sheet
  if (data.length === 0) {
    // Add header row
    await sheetsClient.updateSheetData(sheetName, 'A1:E1', [
      ['ID', 'Name', 'URL', 'SenderEmail', 'ExtractionPattern'],
    ]);
    console.log('Created header row in Newsletters sheet');
  }
}

async function testNewsletterRepository() {
  try {
    const sheetsClient = new GoogleSheetsClient();

    // Set up the test sheet
    await setupTestSheet(sheetsClient);

    // Create repository
    const repository = new GoogleSheetsNewsletterRepository(sheetsClient);
    await repository.initialize();
    console.log('Repository initialized successfully');

    // Get all newsletters
    const newsletters = await repository.getAll();
    console.log('Current newsletters:', newsletters);

    // Create a test newsletter
    const testNewsletter = Newsletter.create({
      name: 'Test Newsletter',
      url: 'https://rais11.quora.com/',
      senderEmail: 'newsletter@example.com',
      extractionPattern: 'View in browser: (https?://\\S+)',
    });

    // Save the newsletter
    console.log('Saving test newsletter...');
    await repository.save(testNewsletter);

    // Check if saved correctly
    const retrieved = await repository.getById(testNewsletter.id);
    console.log('Retrieved newsletter:', retrieved);

    // Verify by email
    const byEmail = await repository.getBySenderEmail('newsletter@example.com');
    console.log('Found by email:', byEmail);

    // Delete the test newsletter
    console.log('Deleting test newsletter...');
    await repository.delete(testNewsletter.id);

    // Confirm deletion
    const afterDelete = await repository.getById(testNewsletter.id);
    console.log('After delete (should be null):', afterDelete);

    console.log('Newsletter repository test completed successfully!');
  } catch (error) {
    console.error('Newsletter repository test failed:', error);
  }
}

testNewsletterRepository();
