import { Queue } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // keep for 24h
      count: 5000,
    },
    removeOnFail: {
      age: 604800, // keep failures for 7 days
      count: 5000,
    },
  },
});

emailQueue.on('error', (err) => {
  logger.error('BullMQ Email Queue Error', { error: err.message });
});

export async function addEmailJob(
  emailId: string,
  scheduledAt: Date
): Promise<void> {
  const now = Date.now();
  const delay = Math.max(0, scheduledAt.getTime() - now);
  const jobId = `email-${emailId}`;

  try {
    const existingJob = await emailQueue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }
  } catch {
    // Ignore error if job does not exist
  }

  await emailQueue.add(
    'send-email',
    { emailId },
    {
      delay,
      jobId, // Deterministic ID prevents duplicate job creation
    }
  );

  logger.info('Enqueued delayed email job', {
    jobId,
    emailId,
    scheduledAt: scheduledAt.toISOString(),
    delayMs: delay,
  });
}

export async function addEmailJobsBulk(
  emails: Array<{ id: string; scheduledAt: Date }>
): Promise<void> {
  const now = Date.now();
  const jobs = emails.map((email) => ({
    name: 'send-email',
    data: { emailId: email.id },
    opts: {
      delay: Math.max(0, email.scheduledAt.getTime() - now),
      jobId: `email-${email.id}`,
    },
  }));

  if (jobs.length > 0) {
    await emailQueue.addBulk(jobs);
    logger.info(`Bulk enqueued ${jobs.length} delayed email jobs`);
  }
}
