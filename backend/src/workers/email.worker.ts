import { Worker, Job } from 'bullmq';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { EMAIL_QUEUE_NAME, addEmailJob } from '../queues/email.queue';
import { smtpService } from '../services/smtp.service';
import { rateLimitService } from '../services/rate-limit.service';
import { slackService } from '../services/slack.service';
import { elasticsearchService } from '../services/elasticsearch.service';
import { logger } from '../utils/logger';
import { EmailStatus } from '../types';

export interface EmailJobPayload {
  emailId: string;
}

export async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { emailId } = job.data;
  logger.info(`Processing email job [${job.id}] for emailId: ${emailId}`, {
    jobId: job.id,
    attempt: job.attemptsMade + 1,
  });

  // 1. Fetch Email and associated Campaign from PostgreSQL
  const emailRecord = await prisma.email.findUnique({
    where: { id: emailId },
    include: { campaign: true },
  });

  if (!emailRecord) {
    logger.warn(`Email record not found in database: ${emailId}. Skipping job.`);
    return;
  }

  // Idempotency check: If already marked as SENT, skip immediately
  if (emailRecord.status === EmailStatus.SENT) {
    logger.info(`Email ${emailId} is already marked as SENT. Skipping redundant execution.`);
    return;
  }

  // 2. Atomic Idempotent State Transition: SCHEDULED -> PROCESSING
  // Ensures only one worker across any instance can process this email
  const updateResult = await prisma.email.updateMany({
    where: {
      id: emailId,
      status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] },
    },
    data: {
      status: EmailStatus.PROCESSING,
    },
  });

  if (updateResult.count === 0) {
    logger.warn(
      `Email ${emailId} could not transition to PROCESSING (already claimed by another worker or in invalid state: ${emailRecord.status}).`
    );
    return;
  }

  const senderId = emailRecord.campaign.userId;
  const hourlyLimit = emailRecord.campaign.hourlyLimit || env.MAX_EMAILS_PER_HOUR;
  const minDelayMs = emailRecord.campaign.delayMs || env.MIN_EMAIL_DELAY_MS;

  // 3. Distributed Hourly Rate Limiting Check (sender-scoped)
  const rateLimit = await rateLimitService.consumeHourlyQuota(hourlyLimit, senderId);

  if (!rateLimit.allowed) {
    logger.warn(
      `Hourly limit (${hourlyLimit}) reached for sender ${senderId}. Rescheduling email ${emailId} for next window in ${rateLimit.msUntilNextHour}ms`
    );

    const nextScheduledTime = new Date(Date.now() + rateLimit.msUntilNextHour);

    // Live verifiable Slack notification dispatched upon hitting rate limit (as required)
    void slackService.sendRateLimitAlert(senderId, {
      currentCount: rateLimit.currentCount,
      limit: hourlyLimit,
      nextHourDate: nextScheduledTime,
      recipient: emailRecord.recipient,
      emailId,
    });

    // Revert status to SCHEDULED with updated scheduledAt for next hourly window
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SCHEDULED,
        scheduledAt: nextScheduledTime,
      },
    });

    // Re-enqueue delayed job for next window (no permanent retry consumed)
    await addEmailJob(emailId, nextScheduledTime);
    return;
  }

  // 4. Distributed Send-Slot Reservation (enforces global inter-email spacing across workers)
  const sendSlot = await rateLimitService.reserveSendSlot(minDelayMs, senderId);
  if (sendSlot.waitTimeMs > 0) {
    logger.info(`Waiting ${sendSlot.waitTimeMs}ms for allocated distributed send slot...`, {
      emailId,
      targetSlotTimestamp: new Date(sendSlot.targetSlotTimestamp).toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, sendSlot.waitTimeMs));
  }

  // 5. Send Email via Nodemailer SMTP (Ethereal / Custom)
  try {
    const sendResult = await smtpService.sendEmail({
      to: emailRecord.recipient,
      subject: emailRecord.campaign.subject,
      body: emailRecord.campaign.body,
    });

    // 6. Mark as SENT in Database
    const sentDate = new Date();

    // Determine viewable preview URL:
    // 1. If Nodemailer connected and sent via Ethereal, use real Ethereal URL
    // 2. If running on Render where cloud firewall blocks outbound SMTP ports, link to live backend preview!
    let recordedMessageId = sendResult.previewUrl ? String(sendResult.previewUrl) : '';
    if (!recordedMessageId || sendResult.isSimulatedPreview) {
      const backendBase = (
        process.env.RENDER_EXTERNAL_URL ||
        process.env.BACKEND_URL ||
        (env.NODE_ENV === 'production'
          ? 'https://reachinbox-email-scheduler-g01t.onrender.com'
          : `http://localhost:${env.PORT}`)
      ).replace(/\/$/, '');
      recordedMessageId = `${backendBase}/api/emails/${emailId}/preview`;
    }

    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SENT,
        sentAt: sentDate,
        messageId: recordedMessageId,
        error: null,
      },
    });

    // Update status in Elasticsearch
    void elasticsearchService.updateEmailStatus(emailId, {
      status: EmailStatus.SENT,
      sentAt: sentDate,
      messageId: recordedMessageId,
      error: null,
    });

    logger.info(`Successfully sent and recorded email ${emailId}`, {
      recipient: emailRecord.recipient,
      messageId: sendResult.messageId,
      previewUrl: sendResult.previewUrl || undefined,
    });
  } catch (sendError) {
    const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
    logger.error(`Failed to send email ${emailId}`, { error: errorMessage });

    // Check if this was the final retry attempt
    const maxAttempts = job.opts.attempts || 5;
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isFinalAttempt) {
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.FAILED,
          attempts: { increment: 1 },
          error: errorMessage,
        },
      });
      void elasticsearchService.updateEmailStatus(emailId, {
        status: EmailStatus.FAILED,
        error: errorMessage,
      });
      logger.error(`Max retries reached for email ${emailId}. Permanently marked as FAILED.`);
    } else {
      // Revert to SCHEDULED for BullMQ exponential backoff retry
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.SCHEDULED,
          attempts: { increment: 1 },
          error: `Attempt ${job.attemptsMade + 1} failed: ${errorMessage}`,
        },
      });
      void elasticsearchService.updateEmailStatus(emailId, {
        status: EmailStatus.SCHEDULED,
        error: `Attempt ${job.attemptsMade + 1} failed: ${errorMessage}`,
      });
    }

    // Re-throw so BullMQ triggers its exponential backoff retry
    throw sendError;
  }
}

export function createEmailWorker(): Worker {
  logger.info('Initializing BullMQ Email Worker...', {
    concurrency: env.WORKER_CONCURRENCY,
    minEmailDelayMs: env.MIN_EMAIL_DELAY_MS,
  });

  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await processEmailJob(job);
    },
    {
      connection: redis,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  worker.on('ready', () => {
    logger.info('BullMQ Email Worker is ready and listening for jobs');
  });

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed`, {
      attemptsMade: job?.attemptsMade,
      error: err.message,
    });
  });

  worker.on('error', (err) => {
    logger.error('BullMQ Worker general error', { error: err.message });
  });

  return worker;
}

// Auto-start worker if executed directly as a standalone process
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  const worker = createEmailWorker();

  const shutdownWorker = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down BullMQ worker gracefully...`);
    await worker.close();
    logger.info('BullMQ worker closed. Exiting.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdownWorker('SIGINT'));
  process.on('SIGTERM', () => shutdownWorker('SIGTERM'));
}
