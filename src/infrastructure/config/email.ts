import dotenv from 'dotenv';
import { ImapConfig } from '../mail/ImapMailService';

// Load environment variables
dotenv.config();

export const emailConfig: ImapConfig = {
  host: process.env.EMAIL_HOST || '',
  port: parseInt(process.env.EMAIL_PORT || '993', 10),
  user: process.env.EMAIL_USER || '',
  password: process.env.EMAIL_PASSWORD || '',
  tls: process.env.EMAIL_TLS !== 'false',
  mailbox: process.env.EMAIL_MAILBOX || 'INBOX',
  searchCriteria: process.env.EMAIL_SEARCH_CRITERIA
    ? JSON.parse(process.env.EMAIL_SEARCH_CRITERIA)
    : ['UNSEEN'],
  markSeen: process.env.EMAIL_MARK_SEEN !== 'false',
};

// Validate the configuration
function validateEmailConfig(): void {
  if (!emailConfig.host) {
    throw new Error('EMAIL_HOST is required');
  }

  if (!emailConfig.user) {
    throw new Error('EMAIL_USER is required');
  }

  if (!emailConfig.password) {
    throw new Error('EMAIL_PASSWORD is required');
  }
}

// Validate on import
validateEmailConfig();

export default emailConfig;
