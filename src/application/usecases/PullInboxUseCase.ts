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

  // Enhanced extractWebUrl method for PullInboxUseCase.ts
  private extractWebUrl(email: any, newsletter: any): string | null {
    console.log('Starting URL extraction process...');

    // Try custom extraction pattern first if defined
    if (newsletter.extractionPattern) {
      try {
        console.log(`Using custom pattern: ${newsletter.extractionPattern}`);
        const regex = new RegExp(newsletter.extractionPattern);
        const match = regex.exec(email.html || email.body);

        if (match && match[1]) {
          console.log(`Found URL using custom pattern: ${match[1]}`);
          return match[1];
        } else {
          console.log('Custom pattern did not match');
        }
      } catch (error) {
        console.error(`Error using custom extraction pattern:`, error);
      }
    }

    const content = email.html || email.body;

    // Check specifically for BeehiivCDN newsletters first
    if (content.includes('beehiiv.com')) {
      console.log('Detected BeehiivCDN newsletter, applying specific extraction');
      // Look for Read Online link pattern
      const beehiivReadOnlinePattern =
        /href="(https:\/\/link\.mail\.beehiiv\.com\/ss\/c\/[^"]+)"[^>]*>(?:[^<]*(?:read\s+online|view\s+online)[^<]*)<\/a>/i;
      const match = beehiivReadOnlinePattern.exec(content);
      if (match && match[1]) {
        console.log(`Found BeehiivCDN Read Online URL: ${match[1]}`);
        return match[1];
      }

      // Alternative pattern for Beehiiv links
      const beehiivLinkPattern = /href="(https:\/\/link\.mail\.beehiiv\.com\/ss\/c\/[^"]+)"/i;
      const altMatch = beehiivLinkPattern.exec(content);
      if (altMatch && altMatch[1]) {
        console.log(`Found BeehiivCDN URL: ${altMatch[1]}`);
        return altMatch[1];
      }
    }

    // Define all common "view in browser" variations
    // This comprehensive set of patterns will catch most newsletter providers
    const viewBrowserVariations = [
      // Common phrases
      /view\s+(?:in|on)\s+(?:browser|web)/i,
      /read\s+(?:in|on|)?\s*(?:browser|web|online)/i, // Added "read online"
      /web\s+(?:view|version)/i,
      /online\s+(?:view|version)/i,
      /view\s+(?:as\s+)?(?:web)?page/i,
      /open\s+(?:in|on)\s+browser/i,
      /email\s+(?:not|doesn't)\s+display\s+(?:correctly|properly)/i,
      /(?:can't|cannot)\s+(?:see|view|read)\s+(?:this|the)\s+email/i,
      /view\s+(?:this|the)\s+(?:email|newsletter)\s+(?:in|on)\s+(?:your|a)\s+browser/i,
      /read\s+online/i, // Simple explicit "read online" pattern

      // Common adjacent characters/phrases
      /(?:\||→|&gt;|&bull;|•|\/|\[|\()\s*(?:view|read)(?:\s+(?:in|on|online|web))?\s*(?:browser|web|webpage|online)/i,
      /(?:view|read)(?:\s+(?:in|on|online|web))?\s*(?:browser|web|webpage|online)\s*(?:\||→|&gt;|&bull;|•|\/|\]|\))/i,

      // Provider-specific patterns
      /(?:Got\s+this\s+from\s+a\s+friend|Forward|Share)\s*(?:\||→|&gt;|&bull;|•|\/|\[|\()?\s*(?:view|read)(?:\s+(?:in|on|online|web))?\s*(?:browser|web|webpage|online)/i,
    ];

    // First try to find the phrases and then look for nearby links
    for (const pattern of viewBrowserVariations) {
      const match = pattern.exec(content);
      if (match) {
        console.log(`Found "${match[0]}" at position ${match.index}`);

        // Look for URLs or links near the match
        const searchRadius = 300; // Increase search radius (was 150)
        const startPos = Math.max(0, match.index - searchRadius);
        const endPos = Math.min(content.length, match.index + match[0].length + searchRadius);
        const nearbyText = content.substring(startPos, endPos);

        // Look for HTML links first
        const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
        const links = [...nearbyText.matchAll(linkRegex)];

        if (links.length > 0) {
          // Find closest link to the match
          let closestLink = links[0][1];
          let minDistance = Infinity;

          links.forEach((link) => {
            const linkPos = nearbyText.indexOf(link[0]);
            const distance = Math.abs(linkPos - (match.index - startPos));
            if (distance < minDistance) {
              minDistance = distance;
              closestLink = link[1];
            }
          });

          console.log(`Found nearby link: ${closestLink}`);
          return closestLink;
        }

        // If no HTML links, look for plain URLs
        const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
        const urls = [...nearbyText.matchAll(urlRegex)];

        if (urls.length > 0) {
          console.log(`Found nearby URL: ${urls[0][1]}`);
          return urls[0][1];
        }
      }
    }

    // If no view-in-browser phrases found, try standard HTML patterns
    const commonHtmlPatterns = [
      // HTML link with view/read in text
      /<a[^>]*href=["']([^"']+)["'][^>]*>(?:[^<]*(?:view|read)[^<]*(?:in|on|online)[^<]*(?:browser|web|webpage|online)[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']+)["'][^>]*>(?:[^<]*(?:web|online)[^<]*(?:view|version)[^<]*)<\/a>/i,
      /<a[^>]*href=["']([^"']+)["'][^>]*>(?:[^<]*(?:read\s+online)[^<]*)<\/a>/i, // Added explicit read online pattern

      // Links with newsletter-related attributes
      /<a[^>]*(?:id|class|data)=["'](?:view|browser|web-version|online|view-online)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i,

      // Email client targeting
      /<a[^>]*href=["']([^"']+)["'][^>]*>(?:[^<]*(?:email|newsletter)[^<]*(?:not)[^<]*(?:display|view|showing)[^<]*)<\/a>/i,

      // BeehiivCDN specific patterns (more relaxed)
      /<a[^>]*href=["'](https:\/\/link\.mail\.beehiiv\.com\/ss\/[^"']+)["'][^>]*>/i,
    ];

    for (const pattern of commonHtmlPatterns) {
      const match = pattern.exec(content);
      if (match && match[1]) {
        console.log(`Found link using HTML pattern: ${match[1]}`);
        return match[1];
      }
    }

    // Try to extract any URL from mail.beehiiv.com
    const beehiivUrlPattern = /https:\/\/link\.mail\.beehiiv\.com\/ss\/[^\s"'<>]+/;
    const beehiivMatch = beehiivUrlPattern.exec(content);
    if (beehiivMatch) {
      console.log(`Found beehiiv URL: ${beehiivMatch[0]}`);
      return beehiivMatch[0];
    }

    // FALLBACK: If all else fails, extract all URLs and try to find a relevant one
    console.log('Using fallback: extract any relevant URL from content');
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    const allUrls = [...content.matchAll(urlRegex)].map((match) => match[1]);

    if (allUrls.length > 0) {
      // Filter out common non-useful URLs
      const nonUsefulDomains = [
        'w3.org',
        'w3schools.com',
        'xmlns.com',
        'schema.org',
        'google-analytics.com',
        'doubleclick.net',
      ];

      // Filter URLs that don't contain non-useful domains
      const filteredUrls = allUrls.filter((url) => {
        return !nonUsefulDomains.some((domain) => url.includes(domain));
      });

      // Look for URLs with newsletter-related keywords
      const keywordsList = [
        'newsletter',
        'browser',
        'view',
        'read',
        'online',
        'web-version',
        'campaign',
        'email',
        'mail',
        'beehiiv',
        newsletter.name.toLowerCase().split(' ')[0],
      ];

      const keywordUrls = filteredUrls.filter((url) => {
        const lowerUrl = url.toLowerCase();
        return keywordsList.some((keyword) => lowerUrl.includes(keyword));
      });

      if (keywordUrls.length > 0) {
        console.log(`Found relevant URL with keywords: ${keywordUrls[0]}`);
        return keywordUrls[0];
      } else if (filteredUrls.length > 0) {
        console.log(`Using first filtered URL: ${filteredUrls[0]}`);
        return filteredUrls[0];
      }
    }

    console.log('No suitable URLs found in email content');
    return null;
  }
}
