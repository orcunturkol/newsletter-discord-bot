export interface EmailMessage {
  id: string;
  messageId?: string;
  from: string;
  subject: string;
  receivedAt: Date;
  body: string;
  html?: string;
}

export interface IMailService {
  /**
   * Connect to the mail server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the mail server
   */
  disconnect(): Promise<void>;

  /**
   * Fetch new unread emails
   */
  fetchNewEmails(): Promise<EmailMessage[]>;

  /**
   * Mark an email as processed
   */
  markAsProcessed(messageId: string): Promise<void>;
}
