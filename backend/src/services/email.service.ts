import { prisma } from '../config/database';
import { EmailStatus } from '../types';

export class EmailService {
  /**
   * Get scheduled emails for a specific user with pagination
   */
  public async getScheduledEmails(
    userId: string,
    page = 1,
    limit = 20,
    campaignId?: string
  ) {
    const skip = (page - 1) * limit;

    const whereClause: {
      campaign: { userId: string };
      status: { in: EmailStatus[] };
      campaignId?: string;
    } = {
      campaign: { userId },
      status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] },
    };

    if (campaignId) {
      whereClause.campaignId = campaignId;
    }

    const [total, emails] = await Promise.all([
      prisma.email.count({ where: whereClause }),
      prisma.email.findMany({
        where: whereClause,
        select: {
          id: true,
          recipient: true,
          scheduledAt: true,
          status: true,
          attempts: true,
          createdAt: true,
          campaign: {
            select: {
              id: true,
              subject: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
          { scheduledAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);

    const formattedEmails = emails.map((e) => ({
      id: e.id,
      recipient: e.recipient,
      subject: e.campaign.subject,
      campaignId: e.campaign.id,
      scheduledAt: e.scheduledAt,
      status: e.status,
      attempts: e.attempts,
      createdAt: e.createdAt,
    }));

    return {
      data: formattedEmails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get sent / failed emails for a specific user with pagination
   */
  public async getSentEmails(
    userId: string,
    page = 1,
    limit = 20,
    campaignId?: string
  ) {
    const skip = (page - 1) * limit;

    const whereClause: {
      campaign: { userId: string };
      status: { in: EmailStatus[] };
      campaignId?: string;
    } = {
      campaign: { userId },
      status: { in: [EmailStatus.SENT, EmailStatus.FAILED] },
    };

    if (campaignId) {
      whereClause.campaignId = campaignId;
    }

    const [total, emails] = await Promise.all([
      prisma.email.count({ where: whereClause }),
      prisma.email.findMany({
        where: whereClause,
        select: {
          id: true,
          recipient: true,
          sentAt: true,
          status: true,
          attempts: true,
          messageId: true,
          error: true,
          createdAt: true,
          campaign: {
            select: {
              id: true,
              subject: true,
            },
          },
        },
        orderBy: [
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);

    const formattedEmails = emails.map((e) => ({
      id: e.id,
      recipient: e.recipient,
      subject: e.campaign.subject,
      campaignId: e.campaign.id,
      sentAt: e.sentAt,
      status: e.status,
      attempts: e.attempts,
      messageId: e.messageId,
      error: e.error,
      createdAt: e.createdAt,
    }));

    return {
      data: formattedEmails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Aggregated email status statistics for a user
   */
  public async getEmailStats(userId: string) {
    const [scheduled, processing, sent, failed] = await Promise.all([
      prisma.email.count({
        where: { campaign: { userId }, status: EmailStatus.SCHEDULED },
      }),
      prisma.email.count({
        where: { campaign: { userId }, status: EmailStatus.PROCESSING },
      }),
      prisma.email.count({
        where: { campaign: { userId }, status: EmailStatus.SENT },
      }),
      prisma.email.count({
        where: { campaign: { userId }, status: EmailStatus.FAILED },
      }),
    ]);

    return {
      total: scheduled + processing + sent + failed,
      scheduled,
      processing,
      sent,
      failed,
    };
  }
}

export const emailService = new EmailService();
