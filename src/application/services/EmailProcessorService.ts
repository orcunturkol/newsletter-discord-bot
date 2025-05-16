import { IMailService, EmailMessage } from '../ports/IMailService';
import { INewsletterRepository } from '../ports/INewsletterRepository';
import { Newsletter } from '../../domain/entities/Newsletter';
import { Issue } from '../../domain/entities/Issue';
import { randomUUID } from 'crypto';

export class EmailProcessorService {
  constructor(
    private readonly mailService: IMailService,
    private readonly newsletterRepository: INewsletterRepository,
  ) {}

  /**
   * Process new emails and extract issues
   */
  async processNewEmails(): Promise<{
    totalEmails: number;
    matchedNewsletters: Newsletter[];
    issues: Issue[];
    errors: { email: string; error: string }[];
  }> {
    // Connect to mail service
    await this.mailService.connect();

    // Fetch new emails
    const emails = await this.mailService.fetchNewEmails();
    console.log(`Found ${emails.length} new emails`);

    const results = {
      totalEmails: emails.length,
      matchedNewsletters: [] as Newsletter[],
      issues: [] as Issue[],
      errors: [] as { email: string; error: string }[],
    };

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
          results.matchedNewsletters.push(newsletter);

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

            results.issues.push(issue);
            console.log(`Created issue with ID: ${issue.id}`);

            // Mark email as processed
            if (email.messageId) {
              await this.mailService.markAsProcessed(email.messageId);
              console.log(`Marked email as processed: ${email.messageId}`);
            }
          } else {
            console.log('Failed to extract web URL');
            results.errors.push({
              email: email.subject,
              error: 'Failed to extract web URL',
            });
          }
        } else {
          console.log(`No matching newsletter found for sender: ${fromEmail}`);
        }
      } catch (error) {
        console.error(`Error processing email ${email.subject}:`, error);
        results.errors.push({
          email: email.subject,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Disconnect from mail service
    await this.mailService.disconnect();

    return results;
  }

  /**
   * Extract web URL from email content
   */
  private extractWebUrl(email: EmailMessage, newsletter: Newsletter): string | null {
    console.log('Starting URL extraction process...');

    // Try custom extraction pattern first
    if (newsletter.extractionPattern) {
      try {
        console.log(`Using custom pattern: ${newsletter.extractionPattern}`);
        const regex = new RegExp(newsletter.extractionPattern);
        const match = regex.exec(email.html || email.body);

        if (match && match[1]) {
          console.log(`Found URL using custom pattern: ${match[1]}`);
          return match[1];
        } else {
          console.log('Custom pattern did not match any URL');
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
      console.log('Checking HTML content for links...');
      for (const pattern of commonPatterns) {
        const match = pattern.exec(email.html);
        if (match && match[1]) {
          console.log(`Found URL in HTML: ${match[1]}`);
          return match[1];
        }
      }
      console.log('No newsletter-specific patterns matched in HTML');
    } else {
      console.log('No HTML content available');
    }

    // Check plain text content
    console.log('Checking plain text content for links...');
    for (const pattern of commonPatterns) {
      const match = pattern.exec(email.body);
      if (match && match[1]) {
        console.log(`Found URL in text: ${match[1]}`);
        return match[1];
      }
    }
    console.log('No newsletter-specific patterns matched in text');

    // FALLBACK: If no patterns matched, extract any URL
    console.log('Using fallback: extract any URL from content');
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    const content = email.html || email.body;
    const allUrls = [...content.matchAll(urlRegex)];

    if (allUrls.length > 0) {
      // Filter out common non-useful URLs
      const nonUsefulDomains = ['w3.org', 'w3schools.com', 'xmlns.com', 'schema.org'];
      // Filter URLs that don't contain non-useful domains
      const filteredUrls = allUrls.filter((url) => {
        return !nonUsefulDomains.some((domain) => url.includes(domain));
      });
      // Find URLs containing keywords related to newsletters
      const keywordUrls = filteredUrls
        .filter((match) => {
          const url = match[0].toLowerCase();
          return ['view', 'newsletter', 'browser', 'online', 'web'].some((keyword) =>
            url.includes(keyword),
          );
        })
        .map((match) => match[0]);
      // Use a keyword URL if found, otherwise use the first filtered URL
      const selectedUrl =
        keywordUrls.length > 0
          ? keywordUrls[0]
          : filteredUrls.length > 0
            ? filteredUrls[0][0]
            : allUrls[0][0];
      console.log(`Using URL as fallback: ${selectedUrl}`);
      return selectedUrl;
    }

    console.log('No URLs found in email content');
    return null;
  }

  /**
   * Get fancy console output for results
   */
  getResultsOutput(results: {
    totalEmails: number;
    matchedNewsletters: Newsletter[];
    issues: Issue[];
    errors: { email: string; error: string }[];
  }): string {
    let output = '\n===================== EMAIL PROCESSING RESULTS =====================\n\n';

    output += `Total emails checked: ${results.totalEmails}\n`;
    output += `Matched newsletters: ${results.matchedNewsletters.length}\n`;
    output += `Issues extracted: ${results.issues.length}\n`;
    output += `Errors: ${results.errors.length}\n\n`;

    if (results.issues.length > 0) {
      output += 'SUCCESSFUL ISSUES:\n';
      results.issues.forEach((issue, index) => {
        output += `  ${index + 1}. ${issue.title}\n`;
        output += `     Link: ${issue.webUrl}\n`;
        output += `     Newsletter ID: ${issue.newsletterId}\n`;
        output += '\n';
      });
    }

    if (results.errors.length > 0) {
      output += 'ERRORS:\n';
      results.errors.forEach((error, index) => {
        output += `  ${index + 1}. ${error.email}: ${error.error}\n`;
      });
    }

    output += '\n=================================================================\n';

    return output;
  }
}
