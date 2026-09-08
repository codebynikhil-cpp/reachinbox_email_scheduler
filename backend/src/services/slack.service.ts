import axios from 'axios';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface SlackConnectOptions {
  webhookUrl?: string;
  code?: string;
}

export class SlackService {
  /**
   * Exchanges an OAuth temporary code for a permanent access token & incoming webhook from Slack
   */
  public async handleOAuthCallback(code: string, userId: string): Promise<boolean> {
    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
      throw new Error('Slack OAuth credentials (SLACK_CLIENT_ID, SLACK_CLIENT_SECRET) are not configured');
    }

    try {
      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: env.SLACK_CLIENT_ID,
          client_secret: env.SLACK_CLIENT_SECRET,
          code,
          redirect_uri: env.SLACK_REDIRECT_URI,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;
      if (!data.ok) {
        logger.error('Slack OAuth token exchange failed', { error: data.error });
        throw new Error(`Slack OAuth error: ${data.error}`);
      }

      const accessToken = data.access_token;
      const webhookUrl = data.incoming_webhook?.url;
      const channel = data.incoming_webhook?.channel || data.incoming_webhook?.channel_id;
      const teamName = data.team?.name;

      await prisma.user.update({
        where: { id: userId },
        data: {
          slackConnected: true,
          slackAccessToken: accessToken,
          slackWebhookUrl: webhookUrl || null,
          slackChannel: channel || null,
          slackTeamName: teamName || null,
        },
      });

      logger.info('User successfully connected Slack via OAuth', { userId, teamName, channel });
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to handle Slack OAuth callback', { error: errMsg, userId });
      throw error;
    }
  }

  /**
   * Connect direct Incoming Webhook for instant zero-friction setup & testing
   */
  public async setWebhook(userId: string, webhookUrl: string): Promise<boolean> {
    // Send a verification ping to the webhook to ensure it's valid
    await axios.post(webhookUrl, {
      text: '🚀 *ReachInbox Scheduler*: Slack notifications successfully connected!',
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        slackConnected: true,
        slackWebhookUrl: webhookUrl,
      },
    });

    logger.info('Connected Slack webhook successfully', { userId });
    return true;
  }

  /**
   * Disconnect Slack for a user
   */
  public async disconnect(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        slackConnected: false,
        slackWebhookUrl: null,
        slackAccessToken: null,
        slackChannel: null,
        slackTeamName: null,
      },
    });
    logger.info('Disconnected Slack', { userId });
  }

  /**
   * Get connection status for a user
   */
  public async getStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        slackConnected: true,
        slackWebhookUrl: true,
        slackChannel: true,
        slackTeamName: true,
      },
    });

    return {
      connected: user?.slackConnected || false,
      hasWebhook: Boolean(user?.slackWebhookUrl),
      channel: user?.slackChannel || null,
      teamName: user?.slackTeamName || null,
    };
  }

  /**
   * Generate OAuth Authorize URL for frontend redirection
   */
  public getOAuthAuthorizeUrl(stateUserId: string): string {
    if (!env.SLACK_CLIENT_ID) {
      return '';
    }
    const scopes = 'incoming-webhook,chat:write';
    return `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
      env.SLACK_CLIENT_ID
    )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
      env.SLACK_REDIRECT_URI
    )}&state=${encodeURIComponent(stateUserId)}`;
  }

  /**
   * Dispatches a live, rich alert message to Slack when sender hits their hourly email rate limit
   */
  public async sendRateLimitAlert(
    userId: string,
    details: {
      senderEmail?: string;
      currentCount: number;
      limit: number;
      nextHourDate: Date;
      recipient: string;
      emailId: string;
    }
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.slackConnected || !user.slackWebhookUrl) {
        // As per requirement: "if the user hasn't connected Slack, rate-limit hits should simply not notify (no crash)"
        logger.debug('Slack not connected for user; skipping rate limit notification', { userId });
        return;
      }

      const formattedDate = details.nextHourDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });

      const payload = {
        text: `⚠️ *ReachInbox Hourly Limit Hit:* Sender ${user.email} reached their limit of ${details.limit} emails/hour.`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚠️ Email Rate Limit Exceeded',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Sender *${user.email}* has hit their hourly sending quota (*${details.currentCount}/${details.limit} emails*). Outgoing emails are being automatically delayed into the next window to preserve sender reputation.`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Delayed Recipient:*\n\`${details.recipient}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Rescheduled Delivery:*\n${formattedDate}`,
              },
              {
                type: 'mrkdwn',
                text: `*Hourly Quota:*\n${details.limit} emails/hr`,
              },
              {
                type: 'mrkdwn',
                text: `*Email ID:*\n\`${details.emailId}\``,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '🤖 _Dispatched automatically by ReachInbox Distributed Scheduler Worker._',
              },
            ],
          },
        ],
      };

      await axios.post(user.slackWebhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      logger.info('Dispatched live Slack alert on rate limit hit', {
        userId,
        recipient: details.recipient,
        webhook: user.slackWebhookUrl.substring(0, 30) + '...',
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn('Could not dispatch Slack rate-limit alert (non-blocking)', {
        userId,
        error: errMsg,
      });
    }
  }
}

export const slackService = new SlackService();
