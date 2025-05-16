import { RepositoryFactory } from '../infrastructure/factories/repositoryFactory';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function debugEmailProcessing() {
  try {
    console.log('Starting email processing debugging...');

    // Get dependencies
    const mailService = RepositoryFactory.getMailService();
    const newsletterRepository = await RepositoryFactory.getNewsletterRepository();

    // Connect to email
    console.log('Connecting to mail server...');
    await mailService.connect();

    // Fetch emails
    console.log('Fetching emails...');
    const emails = await mailService.fetchNewEmails();
    console.log(`Found ${emails.length} emails`);

    // Process each email
    for (const email of emails) {
      console.log('\n========================================');
      console.log(`Email: "${email.subject}" from "${email.from}"`);

      // Extract the sender email
      const fromMatch = email.from.match(/<?([\w.-]+@[\w.-]+)>?/);
      const fromEmail = fromMatch ? fromMatch[1] : email.from;

      // Find matching newsletter
      const newsletter = await newsletterRepository.getBySenderEmail(fromEmail);

      if (newsletter) {
        console.log(`✅ Matched newsletter: "${newsletter.name}"`);

        // Try to extract web URL
        console.log('Attempting to extract web URL...');

        // Try custom extraction pattern first
        if (newsletter.extractionPattern) {
          try {
            console.log(`Using custom pattern: ${newsletter.extractionPattern}`);
            const regex = new RegExp(newsletter.extractionPattern);
            const match = regex.exec(email.html || email.body);

            if (match && match[1]) {
              console.log(`✅ Found URL using custom pattern: ${match[1]}`);
            } else {
              console.log('❌ Custom pattern did not match');
            }
          } catch (error) {
            console.error(
              `Error using custom pattern: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Try common patterns
        const commonPatterns = [
          // Common "View in browser" link patterns
          {
            name: 'View browser link 1',
            pattern:
              /view\s+(?:this|it|the)?(?:\s+newsletter|\s+email)?\s+(?:in|on)(?:\s+a|\s+your)?\s+(?:web\s+)?browser(?:\s+)*(?:<a[^>]*href=["']([^"']+)["'][^>]*>)/i,
          },
          {
            name: 'View browser link 2',
            pattern:
              /view\s+(?:in|on)(?:\s+a|\s+your)?\s+(?:web\s+)?browser(?:\s+)*(?:<a[^>]*href=["']([^"']+)["'][^>]*>)/i,
          },
          {
            name: 'View browser link 3',
            pattern:
              /(?:<a[^>]*href=["']([^"']+)["'][^>]*>)(?:\s+)*view\s+(?:in|on)(?:\s+a|\s+your)?\s+(?:web\s+)?browser/i,
          },

          // Links with text indicating web version
          {
            name: 'Web version link 1',
            pattern:
              /(?:<a[^>]*href=["']([^"']+)["'][^>]*>)(?:\s+)*(?:web\s+version|online\s+version|view\s+online)/i,
          },
          {
            name: 'Web version link 2',
            pattern:
              /(?:web\s+version|online\s+version|view\s+online)(?:\s+)*(?:<a[^>]*href=["']([^"']+)["'][^>]*>)/i,
          },

          // More general patterns
          {
            name: 'General link',
            pattern:
              /(?:<a[^>]*href=["'])(https?:\/\/[^"']+(?:newsletter|campaign|view|browser|online)[^"']*)["'][^>]*>/i,
          },
        ];

        // Check HTML content first if available
        if (email.html) {
          console.log('Checking HTML content for links...');
          let foundLink = false;

          for (const { name, pattern } of commonPatterns) {
            const match = pattern.exec(email.html);
            if (match && match[1]) {
              console.log(`✅ Found URL using pattern "${name}": ${match[1]}`);
              foundLink = true;
              break;
            }
          }

          if (!foundLink) {
            console.log('❌ No matching link patterns in HTML');

            // Count total links in HTML for debugging
            const allLinksRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
            const allLinks = [...email.html.matchAll(allLinksRegex)];
            console.log(`Total links found in HTML: ${allLinks.length}`);

            // Show first few links
            if (allLinks.length > 0) {
              console.log('First 3 links in HTML:');
              for (let i = 0; i < Math.min(3, allLinks.length); i++) {
                console.log(`- ${allLinks[i][1]}`);
              }
            }
          }
        } else {
          console.log('❌ No HTML content available');
        }

        // Check plain text content
        console.log('Checking plain text content for links...');
        let foundLink = false;

        for (const { name, pattern } of commonPatterns) {
          const match = pattern.exec(email.body);
          if (match && match[1]) {
            console.log(`✅ Found URL using pattern "${name}": ${match[1]}`);
            foundLink = true;
            break;
          }
        }

        if (!foundLink) {
          console.log('❌ No matching link patterns in text body');

          // Extract all URLs
          const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
          const textUrls = [...email.body.matchAll(urlRegex)];

          console.log(`Total URLs found in text: ${textUrls.length}`);

          // Show first few URLs
          if (textUrls.length > 0) {
            console.log('First 3 URLs in text:');
            for (let i = 0; i < Math.min(3, textUrls.length); i++) {
              console.log(`- ${textUrls[i][1]}`);
            }
          }
        }
      } else {
        console.log(`❌ No matching newsletter for sender: ${fromEmail}`);
      }

      console.log('========================================');
    }

    // Disconnect
    await mailService.disconnect();
    console.log('\nEmail processing debugging completed');
  } catch (error) {
    console.error('Error during email processing debugging:', error);
  }
}

debugEmailProcessing();
