import { IMailService } from '../ports/IMailService';
import { INewsletterRepository } from '../ports/INewsletterRepository';
import { IIssueRepository } from '../ports/IIssueRepository';
import { Issue } from '../../domain/entities/Issue';

export interface PullInboxResult {
  totalEmails: number;
  matchedNewsletters: number;
  extractedIssues: number;
  errors: Array<{ subject: string; error: string }>;
}

export class PullInboxUseCase {
  constructor(
    private readonly mailService: IMailService,
    private readonly newsletterRepository: INewsletterRepository,
    private readonly issueRepository: IIssueRepository,
  ) {}

  /**
   * Execute the use case: pull emails from inbox and process them
   */
  async execute(): Promise<PullInboxResult> {
    const result: PullInboxResult = {
      totalEmails: 0,
      matchedNewsletters: 0,
      extractedIssues: 0,
      errors: [],
    };

    try {
      // Connect to mail service
      await this.mailService.connect();

      // Fetch new emails
      const emails = await this.mailService.fetchNewEmails();
      result.totalEmails = emails.length;
      console.log(`Found ${emails.length} new emails`);

      // Process each email
      for (const email of emails) {
        try {
          console.log(`Processing email: "${email.subject}" from "${email.from}"`);

          // Extract sender email from the from field
          const fromMatch = email.from.match(/<?([\w.-]+@[\w.-]+)>?/);
          const fromEmail = fromMatch ? fromMatch[1] : email.from;
          console.log(`Extracted sender email: ${fromEmail}`);

          // Find matching newsletter by sender
          const newsletter = await this.newsletterRepository.getBySenderEmail(fromEmail);

          if (newsletter) {
            console.log(`Matched newsletter: ${newsletter.name}`);
            result.matchedNewsletters++;

            // Extract web view link
            console.log('Attempting to extract web URL...');
            const webUrl = this.extractWebUrl(email, newsletter);

            if (webUrl) {
              console.log(`Extracted web URL: ${webUrl}`);

              // Create issue
              const issue = Issue.create({
                newsletterId: newsletter.id,
                title: email.subject,
                webUrl,
                receivedAt: email.receivedAt,
                messageId: email.messageId,
              });

              // Save the issue to repository
              await this.issueRepository.save(issue);
              result.extractedIssues++;
              console.log(`Created and saved issue with ID: ${issue.id}`);

              // Mark email as processed
              if (email.messageId) {
                try {
                  await this.mailService.markAsProcessed(email.messageId);
                  console.log(`Marked email as processed: ${email.messageId}`);
                } catch (error) {
                  console.error(`Error marking email as processed:`, error);
                  // Don't fail the entire process for a marking error
                }
              }
            } else {
              console.log('Failed to extract web URL');
              result.errors.push({
                subject: email.subject,
                error: 'Failed to extract web URL',
              });
            }
          } else {
            console.log(`No matching newsletter found for sender: ${fromEmail}`);
          }
        } catch (error) {
          console.error(`Error processing email ${email.subject}:`, error);
          result.errors.push({
            subject: email.subject,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } finally {
      // Always disconnect from mail service, even if there was an error
      try {
        await this.mailService.disconnect();
      } catch (error) {
        console.error('Error disconnecting from mail service:', error);
      }
    }

    return result;
  }

  /**
   * Extract web URL from email content
   */
  private extractWebUrl(email: any, newsletter: any): string | null {
    // Try custom extraction pattern first
    if (newsletter.extractionPattern) {
      try {
        console.log(`Using custom pattern: ${newsletter.extractionPattern}`);
        const regex = new RegExp(newsletter.extractionPattern);
        const match = regex.exec(email.html || email.body);

        if (match && match[1]) {
          return match[1];
        }
      } catch (error) {
        console.error(`Error using custom extraction pattern:`, error);
      }
    }

    // Try common newsletter patterns
    const commonPatterns = [
      // View in browser patterns
      /view\s+(?:this|it|the)?(?:\s+newsletter|\s+email)?\s+(?:in|on)(?:\s+a|\s+your)?\s+(?:web\s+)?browser(?:\s+)*(?:<a[^>]*href=["']([^"']+)["'][^>]*>)/i,
      /view\s+(?:in|on)(?:\s+a|\s+your)?\s+(?:web\s+)?browser(?:\s+)*(?:<a[^>]*href=["']([^"']+)["'][^>]*>)/i,
      /(?:<a[^>]*href=["']([^"']+)["'][^>]*>)(?:\s+)*view\s+(?:in|on)(?:\s+a|\s+your)?\s+(?:web\s+)?browser/i,

      // Web version patterns
      /(?:<a[^>]*href=["']([^"']+)["'][^>]*>)(?:\s+)*(?:web\s+version|online\s+version|view\s+online)/i,
      /(?:web\s+version|online\s+version|view\s+online)(?:\s+)*(?:<a[^>]*href=["']([^"']+)["'][^>]*>)/i,

      // General newsletter pattern
      /(?:<a[^>]*href=["'])(https?:\/\/[^"']+(?:newsletter|campaign|view|browser|online)[^"']*)["'][^>]*>/i,
    ];

    // Check HTML content first if available
    if (email.html) {
      for (const pattern of commonPatterns) {
        const match = pattern.exec(email.html);
        if (match && match[1]) {
          return match[1];
        }
      }
    }

    // Check plain text content
    for (const pattern of commonPatterns) {
      const match = pattern.exec(email.body);
      if (match && match[1]) {
        return match[1];
      }
    }

    // FALLBACK: If no patterns matched, extract any URL
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    const content = email.html || email.body;
    const allUrls = [...content.matchAll(urlRegex)].map((match) => match[1]);

    if (allUrls.length > 0) {
      // Filter out common non-useful URLs
      const nonUsefulDomains = ['w3.org', 'w3schools.com', 'xmlns.com', 'schema.org'];

      // Filter URLs that don't contain non-useful domains
      const filteredUrls = allUrls.filter((url) => {
        return !nonUsefulDomains.some((domain) => url.includes(domain));
      });

      // Look for URLs with newsletter-related keywords
      const keywordUrls = filteredUrls.filter((url) => {
        const lowerUrl = url.toLowerCase();
        return (
          lowerUrl.includes(newsletter.name.toLowerCase().split(' ')[0]) ||
          lowerUrl.includes('newsletter') ||
          lowerUrl.includes('mail') ||
          lowerUrl.includes('view') ||
          lowerUrl.includes('beehiiv') || // For beehiiv-based newsletters
          lowerUrl.includes('substack')
        ); // For Substack newsletters
      });

      // Use a keyword URL if found, otherwise use the first filtered URL
      return keywordUrls.length > 0
        ? keywordUrls[0]
        : filteredUrls.length > 0
          ? filteredUrls[0]
          : allUrls[0];
    }

    return null;
  }
}
