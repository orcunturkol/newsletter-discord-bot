import dotenv from 'dotenv';
import { GoogleSheetsClient } from '../infrastructure/googlesheets/GoogleSheetsClient';

// Load environment variables
dotenv.config();

async function testGoogleSheetsConnection() {
  try {
    const sheetsClient = new GoogleSheetsClient();

    // Test getting list of sheets
    console.log('Fetching available sheets...');
    const sheets = await sheetsClient.getSheets();
    console.log('Available sheets:', sheets);

    // Test getting data from the first sheet
    if (sheets.length > 0) {
      console.log(`Fetching data from sheet "${sheets[0]}"...`);
      const data = await sheetsClient.getSheetData(sheets[0]);
      console.log('Sheet data:');
      console.table(data);
    }

    console.log('Google Sheets connection test completed successfully!');
  } catch (error) {
    console.error('Google Sheets connection test failed:', error);
  }
}

testGoogleSheetsConnection();
