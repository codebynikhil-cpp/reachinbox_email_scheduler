import { prisma } from '../config/database';
import { addEmailJobsBulk, emailQueue } from '../queues/email.queue';
import { CreateCampaignInput } from '../validators/campaign.validator';
import { logger } from '../utils/logger';
import { EmailStatus } from '../types';
import { elasticsearchService } from './elasticsearch.service';

export class CampaignService {
  /**
   * Schedule a new campaign with staggered delayed email jobs
   */
  public async createCampaign(userId: string, input: CreateCampaignInput) {
    const baseStartTime = new Date(input.startTime);
    const delayMs = input.delayMs;
    const hourlyLimit = input.hourlyLimit;

    // 1. Prepare email schedule entries
    const recipients = input.recipients;
    const scheduledEmailsData: Array<{
      recipient: string;
      scheduledAt: Date;
    }> = recipients.map((recipient, index) => {
      const scheduledTime = new Date(baseStartTime.getTime() + index * delayMs);
      return {
        recipient,
        scheduledAt: scheduledTime,
      };
    });

    // 2. Transactionally save Campaign and Emails to PostgreSQL
    const { campaign, emails } = await prisma.$transaction(async (tx) => {
      const createdCampaign = await tx.campaign.create({
        data: {
          userId,
          subject: input.subject,
          body: input.body,
          startTime: baseStartTime,
          delayMs,
          hourlyLimit,
        },
      });

      // Create individual email records so we obtain generated IDs
      const createdEmails = await Promise.all(
        scheduledEmailsData.map((data) =>
          tx.email.create({
            data: {
              campaignId: createdCampaign.id,
              recipient: data.recipient,
              scheduledAt: data.scheduledAt,
              status: EmailStatus.SCHEDULED,
            },
          })
        )
      );

      return { campaign: createdCampaign, emails: createdEmails };
    });

    logger.info('Campaign created in database', {
      campaignId: campaign.id,
      totalEmails: emails.length,
      userId,
    });

    // 3. Enqueue delayed jobs to BullMQ with deterministic IDs (email:<emailId>)
    const jobPayloads = emails.map((e) => ({
      id: e.id,
      scheduledAt: e.scheduledAt,
    }));

    await addEmailJobsBulk(jobPayloads);

    // 4. Index newly created emails into Elasticsearch asynchronously
    void elasticsearchService.indexEmails(
      emails.map((e) => ({
        id: e.id,
        campaignId: campaign.id,
        userId,
        recipient: e.recipient,
        subject: campaign.subject,
        body: campaign.body,
        status: e.status,
        scheduledAt: e.scheduledAt.toISOString(),
        createdAt: e.createdAt.toISOString(),
      }))
    );

    const firstScheduledAt = emails.length > 0 ? emails[0].scheduledAt : baseStartTime;
    const lastScheduledAt =
      emails.length > 0 ? emails[emails.length - 1].scheduledAt : baseStartTime;

    return {
      success: true,
      campaignId: campaign.id,
      subject: campaign.subject,
      totalScheduled: emails.length,
      firstScheduledAt,
      lastScheduledAt,
      hourlyLimit,
      delayMs,
    };
  }

  /**
   * Startup reconciler: Enqueues any SCHEDULED emails in PostgreSQL that lack a BullMQ job
   * (e.g. if the process was terminated during enqueueing).
   * Safe because BullMQ job IDs are deterministic (email:<emailId>).
   */
  public async reconcileScheduledJobs(): Promise<number> {
    try {
      // 1. Recover stale PROCESSING emails older than 60 seconds
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const staleResult = await prisma.email.updateMany({
        where: {
          status: EmailStatus.PROCESSING,
          updatedAt: { lt: oneMinuteAgo },
        },
        data: {
          status: EmailStatus.SCHEDULED,
        },
      });

      if (staleResult.count > 0) {
        logger.info(`Reconciled ${staleResult.count} stale PROCESSING emails back to SCHEDULED.`);
      }

      // 2. Permanently mark emails that exceeded max retry attempts (>= 5) as FAILED
      const maxAttemptsResult = await prisma.email.updateMany({
        where: {
          status: EmailStatus.SCHEDULED,
          attempts: { gte: 5 },
        },
        data: {
          status: EmailStatus.FAILED,
          error: 'Maximum retry attempts exceeded during previous dispatch',
        },
      });

      if (maxAttemptsResult.count > 0) {
        logger.info(`Marked ${maxAttemptsResult.count} max-attempt emails as FAILED.`);
      }

      // 3. Fetch all active SCHEDULED emails to ensure they are enqueued and running in BullMQ
      const pendingEmails = await prisma.email.findMany({
        where: {
          status: EmailStatus.SCHEDULED,
        },
        select: {
          id: true,
          scheduledAt: true,
        },
        take: 1000,
      });

      if (pendingEmails.length === 0) {
        return 0;
      }

      logger.info(`Reconciling ${pendingEmails.length} SCHEDULED emails with BullMQ...`);
      const now = Date.now();

      // For each pending email, clean up any previous stalled job key in Redis and enqueue fresh
      for (const email of pendingEmails) {
        const delay = Math.max(0, email.scheduledAt.getTime() - now);

        try {
          const oldJob = await emailQueue.getJob(`email-${email.id}`);
          if (oldJob) {
            const state = await oldJob.getState();
            // If already active or waiting, do not interrupt
            if (state === 'active' || state === 'waiting' || state === 'delayed') {
              continue;
            }
            await oldJob.remove();
          }
        } catch {
          // ignore lookup errors
        }

        await emailQueue.add(
          'send-email',
          { emailId: email.id },
          {
            delay,
            jobId: `email-${email.id}-${now}`,
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          }
        );
      }

      return pendingEmails.length;
    } catch (error) {
      logger.error('Error during scheduled job reconciliation', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}

export const campaignService = new CampaignService();
