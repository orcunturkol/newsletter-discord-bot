import { IMailService, EmailMessage } from '../../application/ports/IMailService';
import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { Readable } from 'stream';

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  mailbox?: string;
  searchCriteria?: any[];
  markSeen?: boolean;
}

export class ImapMailService implements IMailService {
  private imap: Imap;
  private isConnected: boolean = false;
  private readonly config: ImapConfig;

  constructor(config: ImapConfig) {
    this.config = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      tls: config.tls !== false, // Default to true if not specified
      mailbox: config.mailbox || 'INBOX',
      searchCriteria: config.searchCriteria || ['UNSEEN'],
      markSeen: config.markSeen !== false, // Default to true if not specified
    };

    this.imap = new Imap({
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      tls: this.config.tls,
      tlsOptions: { rejectUnauthorized: false }, // Note: In production, consider setting this to true
      authTimeout: 30000, // 30 seconds timeout for auth
    });

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Connect to the mail server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        this.isConnected = true;
        console.log('IMAP connection established');
        resolve();
      });

      this.imap.once('error', (err) => {
        console.error('IMAP connection error:', err);
        reject(err);
      });

      // Start the connection
      this.imap.connect();
    });
  }

  /**
   * Disconnect from the mail server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    return new Promise((resolve) => {
      this.imap.once('end', () => {
        this.isConnected = false;
        console.log('IMAP connection ended');
        resolve();
      });

      this.imap.end();
    });
  }

  /**
   * Fetch new unread emails
   */
  async fetchNewEmails(): Promise<EmailMessage[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.imap.openBox(this.config.mailbox || 'INBOX', false, (err, mailbox) => {
        if (err) {
          console.error(`Error opening mailbox ${this.config.mailbox}:`, err);
          return reject(err);
        }

        console.log(`Mailbox ${this.config.mailbox} opened`);

        // Search for unseen emails
        this.imap.search(this.config.searchCriteria || ['UNSEEN'], (err, results) => {
          if (err) {
            console.error('Error searching for emails:', err);
            return reject(err);
          }

          if (!results || results.length === 0) {
            console.log('No new emails found');
            return resolve([]);
          }

          console.log(`Found ${results.length} new emails`);

          const emails: EmailMessage[] = [];
          const fetch = this.imap.fetch(results, {
            bodies: '', // Get the entire message, not just parts
            markSeen: this.config.markSeen,
            struct: true,
          });

          fetch.on('message', (msg, seqno) => {
            console.log(`Processing message #${seqno}`);
            let buffer = '';

            msg.on('body', (stream, info) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
            });

            // Get the message ID for future reference
            let uid: string;
            msg.once('attributes', (attrs) => {
              uid = attrs.uid?.toString() || seqno.toString();
            });

            msg.once('end', () => {
              // Parse the full email when we have the complete buffer
              this.parseFullEmail(buffer, uid, seqno.toString())
                .then((email) => {
                  if (email) {
                    emails.push(email);
                  }
                })
                .catch((error) => {
                  console.error(`Error parsing message #${seqno}:`, error);
                });
            });
          });

          fetch.once('error', (err) => {
            console.error('Error fetching emails:', err);
            reject(err);
          });

          fetch.once('end', () => {
            console.log('Done fetching emails');
            resolve(emails);
          });
        });
      });
    });
  }
  /**
   * Parse a complete email buffer into an EmailMessage
   */
  private async parseFullEmail(
    buffer: string,
    uid: string,
    sequenceNumber: string,
  ): Promise<EmailMessage | null> {
    try {
      // Parse the full email using mailparser
      const parsed = await simpleParser(buffer);

      // Extract the necessary information
      return {
        id: sequenceNumber,
        messageId: uid,
        from: parsed.from?.text || '',
        subject: parsed.subject || '',
        receivedAt: parsed.date || new Date(),
        body: parsed.text || '',
        html: parsed.html || undefined,
      };
    } catch (error) {
      console.error('Error parsing email:', error);
      return null;
    }
  }
  /**
   * Parse email bodies to extract HTML content
   */
  private async parseEmailBodies(emails: EmailMessage[]): Promise<EmailMessage[]> {
    return Promise.all(
      emails.map(async (email) => {
        try {
          // Skip parsing if body is undefined
          if (!email.body) {
            return {
              ...email,
              body: '', // Provide a default empty string for undefined bodies
            };
          }

          // Create a readable stream from the email body
          const stream = new Readable();
          stream.push(email.body); // Now we know body is defined
          stream.push(null); // End the stream

          // Parse the email
          const parsed = await simpleParser(stream);

          // Update the email object with parsed content
          return {
            ...email,
            body: parsed.text || email.body, // Use original body as fallback
            html: parsed.html || undefined,
          };
        } catch (error) {
          console.error(`Error parsing email body for ${email.subject}:`, error);
          return {
            ...email,
            body: email.body || '', // Ensure body is never undefined
          };
        }
      }),
    );
  }

  /**
   * Mark an email as processed
   */
  async markAsProcessed(messageId: string): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.imap.openBox(this.config.mailbox || 'INBOX', false, (err) => {
        if (err) {
          console.error(`Error opening mailbox ${this.config.mailbox}:`, err);
          return reject(err);
        }

        // Use standard IMAP flags only (no $Processed custom flag)
        this.imap.setFlags([messageId], ['\\Seen', '\\Flagged'], (err) => {
          if (err) {
            console.error(`Error marking message ${messageId} as processed:`, err);
            return reject(err);
          }

          console.log(`Message ${messageId} marked as processed`);
          resolve();
        });
      });
    });
  }

  /**
   * Setup event handlers for the IMAP connection
   */
  private setupEventHandlers(): void {
    this.imap.on('error', (err) => {
      console.error('IMAP error:', err);
      this.isConnected = false;
    });

    this.imap.on('end', () => {
      console.log('IMAP connection ended');
      this.isConnected = false;
    });
  }
}
