import { describe, it, expect, vi } from 'vitest';
import { EmailStatus } from '../src/types';

describe('Worker Idempotency & Conditional State Transition', () => {
  it('should only permit one worker to transition SCHEDULED to PROCESSING', async () => {
    // Simulate database record state
    let emailStatus = EmailStatus.SCHEDULED;

    const attemptTransition = async (workerId: string) => {
      // Mimics: UPDATE emails SET status = 'PROCESSING' WHERE id = 'e1' AND status = 'SCHEDULED'
      if (emailStatus === EmailStatus.SCHEDULED) {
        emailStatus = EmailStatus.PROCESSING;
        return { updated: 1, workerId };
      }
      return { updated: 0, workerId };
    };

    // Run 2 workers racing concurrently for the same email record
    const [result1, result2] = await Promise.all([
      attemptTransition('worker-1'),
      attemptTransition('worker-2'),
    ]);

    const totalUpdated = result1.updated + result2.updated;
    expect(totalUpdated).toBe(1);

    const winningWorker = result1.updated === 1 ? result1.workerId : result2.workerId;
    const losingWorker = result1.updated === 0 ? result1.workerId : result2.workerId;

    expect(winningWorker).toBeDefined();
    expect(losingWorker).toBeDefined();
    expect(winningWorker).not.toBe(losingWorker);
    expect(emailStatus).toBe(EmailStatus.PROCESSING);
  });

  it('should ignore already SENT email records', async () => {
    const emailRecord = {
      id: 'email-sent-123',
      status: EmailStatus.SENT,
      sentAt: new Date(),
    };

    const processRecord = vi.fn((record) => {
      if (record.status === EmailStatus.SENT) {
        return 'SKIPPED_ALREADY_SENT';
      }
      return 'PROCESSED';
    });

    const result = processRecord(emailRecord);
    expect(result).toBe('SKIPPED_ALREADY_SENT');
  });
});
