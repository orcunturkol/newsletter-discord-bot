export class OAuthHelper {
  /**
   * Generate the OAuth2 URL for bot installation
   */
  static generateOAuthUrl(clientId: string, redirectUri?: string): string {
    // Required permissions:
    // - Read Messages/View Channels (for accessing channels)
    // - Send Messages (for posting newsletters)
    // - Embed Links (for rich embeds)
    // - Attach Files (for potential future attachments)
    // - Use Slash Commands (for command registration)

    const permissions = [
      '268435456', // View Channels
      '2048', // Send Messages
      '16384', // Embed Links
      '32768', // Attach Files
      '2147483648', // Use Slash Commands
    ].reduce((a, b) => (BigInt(a) + BigInt(b)).toString());

    const scopes = ['bot', 'applications.commands'].join('%20');

    let url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scopes}`;

    if (redirectUri) {
      url += `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }

    return url;
  }
}
