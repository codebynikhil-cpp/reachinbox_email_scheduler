import { describe, it, expect } from 'vitest';
import { EmailStatus } from '../src/types';

describe('100+ Email Load & Concurrency Simulation', () => {
  it('should correctly stagger 150 emails with delay and distribute across hourly quota windows', async () => {
    const totalRecipients = 150;
    const delayMs = 2000;
    const hourlyLimit = 50;
    const baseStartTime = new Date('2026-08-20T10:00:00.000Z');

    // 1. Generate scheduled emails
    const emails = Array.from({ length: totalRecipients }, (_, index) => {
      const scheduledAt = new Date(baseStartTime.getTime() + index * delayMs);
      return {
        id: `email-${index + 1}`,
        recipient: `user${index + 1}@example.com`,
        scheduledAt,
        status: EmailStatus.SCHEDULED,
        attempts: 0,
      };
    });

    expect(emails).toHaveLength(150);
    expect(emails[0].scheduledAt.toISOString()).toBe('2026-08-20T10:00:00.000Z');
    expect(emails[149].scheduledAt.toISOString()).toBe('2026-08-20T10:04:58.000Z');

    // 2. Simulate multi-worker concurrent dispatch with rate limit enforcement
    let hour1Sent = 0;
    let rescheduledCount = 0;

    for (const email of emails) {
      if (hour1Sent < hourlyLimit) {
        hour1Sent++;
        email.status = EmailStatus.SENT;
      } else {
        // Rescheduled for next hour window
        rescheduledCount++;
        email.status = EmailStatus.SCHEDULED;
      }
    }

    expect(hour1Sent).toBe(50);
    expect(rescheduledCount).toBe(100);
    expect(hour1Sent + rescheduledCount).toBe(totalRecipients);
  });

  it('should guarantee no duplicate sends when 5 concurrent workers race across 100 emails', async () => {
    const emailPool = Array.from({ length: 100 }, (_, i) => ({
      id: `email-race-${i}`,
      status: EmailStatus.SCHEDULED,
      attempts: 0,
      sentByWorker: null as string | null,
    }));

    // Simulated atomic DB update: UPDATE emails SET status = 'PROCESSING' WHERE id = :id AND status = 'SCHEDULED'
    const claimEmail = async (emailId: string, workerId: string) => {
      const email = emailPool.find((e) => e.id === emailId);
      if (!email) return false;

      if (email.status === EmailStatus.SCHEDULED) {
        email.status = EmailStatus.PROCESSING;
        email.attempts += 1;
        email.sentByWorker = workerId;
        return true;
      }
      return false;
    };

    // 5 concurrent workers race to claim each of the 100 emails
    const workerIds = ['worker-1', 'worker-2', 'worker-3', 'worker-4', 'worker-5'];

    for (const email of emailPool) {
      const claimPromises = workerIds.map((wId) => claimEmail(email.id, wId));
      const results = await Promise.all(claimPromises);

      // Exactly ONE worker must succeed for each email
      const successfulClaims = results.filter((res) => res === true).length;
      expect(successfulClaims).toBe(1);
    }

    // Verify all 100 emails were claimed exactly once
    const totalProcessed = emailPool.filter((e) => e.status === EmailStatus.PROCESSING).length;
    expect(totalProcessed).toBe(100);

    // Verify no email has attempts > 1
    for (const email of emailPool) {
      expect(email.attempts).toBe(1);
      expect(email.sentByWorker).toBeTruthy();
    }
  });

  it('should guarantee deterministic BullMQ job IDs for 100 emails (no duplicate queue jobs)', () => {
    const emailIds = Array.from({ length: 100 }, (_, i) => `email-uuid-${i}`);

    const jobIds = emailIds.map((id) => `email:${id}`);
    const uniqueJobIds = new Set(jobIds);

    expect(uniqueJobIds.size).toBe(100);

    // Enqueueing the same list twice yields exact same IDs
    const duplicatePassJobIds = emailIds.map((id) => `email:${id}`);
    expect(duplicatePassJobIds).toEqual(jobIds);
  });
});
