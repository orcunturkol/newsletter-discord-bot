import { IIssueRepository } from '../ports/IIssueRepository';
import { IGuildSubscriptionRepository } from '../ports/IGuildSubscriptionRepository';
import { Issue } from '../../domain/entities/Issue';
import { DiscordClient } from '../../infrastructure/discord/DiscordClient';

export class DispatchIssueUseCase {
  constructor(
    private readonly issueRepository: IIssueRepository,
    private readonly guildSubscriptionRepository: IGuildSubscriptionRepository,
    private readonly discordClient: DiscordClient,
  ) {}

  /**
   * Dispatch a single issue to subscribed Discord channels
   */
  async dispatchIssue(issueId: string): Promise<{
    success: boolean;
    channelsDispatched: number;
    errors: Array<{ guildId: string; channelId: string; error: string }>;
  }> {
    // Get the issue
    const issue = await this.issueRepository.getById(issueId);
    if (!issue) {
      throw new Error(`Issue with ID ${issueId} not found`);
    }

    return this.dispatchIssueInternal(issue);
  }

  /**
   * Dispatch all unprocessed issues
   */
  async dispatchUnprocessedIssues(): Promise<{
    totalIssues: number;
    successfulIssues: number;
    failedIssues: number;
    totalChannels: number;
    errors: Array<{ issueId: string; guildId: string; channelId: string; error: string }>;
  }> {
    // Get all unprocessed issues
    const unprocessedIssues = await this.issueRepository.getUnprocessed();
    console.log(`Found ${unprocessedIssues.length} unprocessed issues`);

    const result = {
      totalIssues: unprocessedIssues.length,
      successfulIssues: 0,
      failedIssues: 0,
      totalChannels: 0,
      errors: [] as Array<{ issueId: string; guildId: string; channelId: string; error: string }>,
    };

    // Process each issue
    for (const issue of unprocessedIssues) {
      try {
        const dispatchResult = await this.dispatchIssueInternal(issue);

        if (dispatchResult.success) {
          result.successfulIssues++;
          result.totalChannels += dispatchResult.channelsDispatched;
        } else {
          result.failedIssues++;
        }

        // Add errors to result
        dispatchResult.errors.forEach((error) => {
          result.errors.push({
            issueId: issue.id,
            ...error,
          });
        });

        // Mark as processed regardless of success/failure
        await this.issueRepository.markAsProcessed(issue.id);
      } catch (error) {
        console.error(`Error dispatching issue ${issue.id}:`, error);
        result.failedIssues++;
      }
    }

    return result;
  }

  private async dispatchIssueInternal(issue: Issue): Promise<{
    success: boolean;
    channelsDispatched: number;
    errors: Array<{ guildId: string; channelId: string; error: string }>;
  }> {
    // Get subscriptions for this newsletter
    const subscriptions = await this.guildSubscriptionRepository.getActiveByNewsletterId(
      issue.newsletterId,
    );
    console.log(
      `Found ${subscriptions.length} active subscriptions for newsletter ${issue.newsletterId}`,
    );

    const result = {
      success: false,
      channelsDispatched: 0,
      errors: [] as Array<{ guildId: string; channelId: string; error: string }>,
    };

    // No subscriptions
    if (subscriptions.length === 0) {
      console.log(`No active subscriptions for newsletter ${issue.newsletterId}`);
      return { ...result, success: true };
    }

    // Dispatch to each subscribed channel
    for (const subscription of subscriptions) {
      try {
        console.log(
          `Posting to channel ${subscription.channelId} (guild: ${subscription.guildId})`,
        );
        await this.discordClient.postToChannel({
          channelId: subscription.channelId,
          title: issue.title,
          url: issue.webUrl,
          footer: `Sent at ${issue.receivedAt.toLocaleString()}`,
          timestamp: new Date(),
        });

        console.log(`Successfully posted to channel ${subscription.channelId}`);
        result.channelsDispatched++;
      } catch (error) {
        console.error(`Error posting to channel ${subscription.channelId}:`, error);
        result.errors.push({
          guildId: subscription.guildId,
          channelId: subscription.channelId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Mark success if at least one channel was dispatched to
    result.success = result.channelsDispatched > 0;

    return result;
  }
}
