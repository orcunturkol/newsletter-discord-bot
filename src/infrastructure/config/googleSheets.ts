import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

// Load environment variables
const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
const sheetId = process.env.GOOGLE_SHEET_ID || '';

if (!keyFilePath || !sheetId) {
  throw new Error('Google Sheets configuration is missing. Check your environment variables.');
}

// Load the service account key file
let credentials;
try {
  // Check if it's a JSON string or a file path
  if (keyFilePath.trim().startsWith('{')) {
    credentials = JSON.parse(keyFilePath);
  } else {
    const resolvedPath = path.resolve(keyFilePath);
    credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }
} catch (error) {
  throw new Error(`Failed to parse Google service account key: ${error}`);
}

// Create JWT client
const auth = new google.auth.JWT(credentials.client_email, undefined, credentials.private_key, [
  'https://www.googleapis.com/auth/spreadsheets',
]);

// Create Google Sheets client
const sheets = google.sheets({ version: 'v4', auth });

export { sheets, sheetId };
