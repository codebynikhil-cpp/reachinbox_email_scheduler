import { describe, it, expect } from 'vitest';
import { createCampaignSchema } from '../src/validators/campaign.validator';

describe('Campaign Validation & Scheduling Logic', () => {
  it('should validate and transform valid campaign input', async () => {
    const rawInput = {
      body: {
        subject: 'Weekly Newsletter',
        body: 'Here is your newsletter update...',
        recipients: ['alice@example.com', 'bob@example.com', 'ALICE@example.com'],
        startTime: '2026-08-20T12:00:00.000Z',
        delayMs: 3000,
        hourlyLimit: 150,
      },
    };

    const parsed = await createCampaignSchema.parseAsync(rawInput);
    expect(parsed.body.subject).toBe('Weekly Newsletter');
    expect(parsed.body.delayMs).toBe(3000);
    expect(parsed.body.hourlyLimit).toBe(150);
    // Deduplication check
    expect(parsed.body.recipients).toHaveLength(2);
    expect(parsed.body.recipients).toEqual(['alice@example.com', 'bob@example.com']);
  });

  it('should calculate correct scheduled timestamps for staggered emails', () => {
    const baseStartTime = new Date('2026-08-20T10:00:00.000Z');
    const delayMs = 2000;
    const recipients = ['user1@test.com', 'user2@test.com', 'user3@test.com', 'user4@test.com'];

    const scheduledTimes = recipients.map((r, i) => new Date(baseStartTime.getTime() + i * delayMs));

    expect(scheduledTimes[0].toISOString()).toBe('2026-08-20T10:00:00.000Z');
    expect(scheduledTimes[1].toISOString()).toBe('2026-08-20T10:00:02.000Z');
    expect(scheduledTimes[2].toISOString()).toBe('2026-08-20T10:00:04.000Z');
    expect(scheduledTimes[3].toISOString()).toBe('2026-08-20T10:00:06.000Z');
  });

  it('should reject invalid email formats in recipients', async () => {
    const invalidInput = {
      body: {
        subject: 'Test',
        body: 'Test Body',
        recipients: ['valid@email.com', 'not-a-valid-email'],
        startTime: '2026-08-20T12:00:00.000Z',
        delayMs: 1000,
        hourlyLimit: 100,
      },
    };

    await expect(createCampaignSchema.parseAsync(invalidInput)).rejects.toThrow();
  });

  it('should reject non-positive delayMs or hourlyLimit', async () => {
    const invalidInput = {
      body: {
        subject: 'Test',
        body: 'Test Body',
        recipients: ['valid@email.com'],
        startTime: '2026-08-20T12:00:00.000Z',
        delayMs: -500,
        hourlyLimit: 0,
      },
    };

    await expect(createCampaignSchema.parseAsync(invalidInput)).rejects.toThrow();
  });
});
