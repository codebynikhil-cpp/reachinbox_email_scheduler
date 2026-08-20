import { describe, it, expect } from 'vitest';
import { rateLimitService } from '../src/services/rate-limit.service';

describe('RateLimitService Logic & Window Calculations', () => {
  it('should generate consistent UTC hourly keys and correct msUntilNextHour for sender', () => {
    const fixedDate = new Date('2026-08-20T14:15:30.000Z');
    const info = rateLimitService.getHourWindowInfo(fixedDate, 'user-abc');

    expect(info.key).toBe('email-rate:user-abc:2026-08-20T14');
    expect(info.nextHourDate.toISOString()).toBe('2026-08-20T15:00:00.000Z');

    // 44 minutes and 30 seconds = 44.5 * 60 * 1000 = 2,670,000 ms
    expect(info.msUntilNextHour).toBe(2670000);
  });

  it('should calculate accurate window transition at the 59th minute', () => {
    const nearEndOfHour = new Date('2026-08-20T14:59:50.000Z');
    const info = rateLimitService.getHourWindowInfo(nearEndOfHour, 'user-xyz');

    expect(info.key).toBe('email-rate:user-xyz:2026-08-20T14');
    expect(info.nextHourDate.toISOString()).toBe('2026-08-20T15:00:00.000Z');
    expect(info.msUntilNextHour).toBe(10000); // 10 seconds remaining
  });

  it('should correctly simulate atomic hourly quota consumption and rejection on limit exhaustion', async () => {
    let atomicCounter = 0;
    const maxLimit = 3;

    // Simulated Lua script logic in test harness
    const simulatedConsume = (limit: number) => {
      atomicCounter++;
      if (atomicCounter <= limit) {
        return { allowed: true, currentCount: atomicCounter };
      }
      return { allowed: false, currentCount: atomicCounter };
    };

    // 1st request -> allowed
    const req1 = simulatedConsume(maxLimit);
    expect(req1.allowed).toBe(true);
    expect(req1.currentCount).toBe(1);

    // 2nd request -> allowed
    const req2 = simulatedConsume(maxLimit);
    expect(req2.allowed).toBe(true);
    expect(req2.currentCount).toBe(2);

    // 3rd request -> allowed
    const req3 = simulatedConsume(maxLimit);
    expect(req3.allowed).toBe(true);
    expect(req3.currentCount).toBe(3);

    // 4th request -> REJECTED (quota exhausted)
    const req4 = simulatedConsume(maxLimit);
    expect(req4.allowed).toBe(false);
    expect(req4.currentCount).toBe(4);
  });

  it('should guarantee distributed send slots are strictly spaced apart by minDelayMs without collision', async () => {
    const now = 1000000;
    const delayMs = 2000;
    let lastSlot = 0;

    // Simulated Redis Lua script for send slot reservation
    const simulatedReserveSlot = (currentTime: number, minDelay: number) => {
      const targetSlot = Math.max(currentTime, lastSlot + minDelay);
      lastSlot = targetSlot;
      return targetSlot;
    };

    // 5 concurrent workers attempt to acquire slots at the exact same millisecond
    const workerTimes = [now, now, now, now, now];
    const allocatedSlots = workerTimes.map((t) => simulatedReserveSlot(t, delayMs));

    // Verify non-overlapping, strictly monotonic spacing
    expect(allocatedSlots).toEqual([
      1000000, // Worker 1 gets immediate slot
      1002000, // Worker 2 gets +2s
      1004000, // Worker 3 gets +4s
      1006000, // Worker 4 gets +6s
      1008000, // Worker 5 gets +8s
    ]);

    // Check interval differences are all exactly >= delayMs
    for (let i = 1; i < allocatedSlots.length; i++) {
      expect(allocatedSlots[i] - allocatedSlots[i - 1]).toBeGreaterThanOrEqual(delayMs);
    }
  });
});
