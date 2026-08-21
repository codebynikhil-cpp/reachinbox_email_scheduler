import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  msUntilNextHour: number;
  nextHourDate: Date;
}

export interface SendSlotResult {
  targetSlotTimestamp: number;
  waitTimeMs: number;
}

/**
 * Lua script for atomic hourly rate limiting
 *
 * KEYS[1] = Rate limit key (e.g. 'email-rate:sender1:2026-08-20T10')
 * ARGV[1] = Max allowed count per hour
 * ARGV[2] = Key TTL in seconds (e.g. 7200)
 *
 * Returns: [allowed (1 or 0), currentCount]
 */
const RATE_LIMIT_LUA_SCRIPT = `
  local current = tonumber(redis.call('GET', KEYS[1]) or '0')
  local maxLimit = tonumber(ARGV[1])
  if current < maxLimit then
    current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
    end
    return {1, current}
  else
    return {0, current}
  end
`;

/**
 * Lua script for distributed send slot reservation (enforces global minimum delay across workers)
 *
 * KEYS[1] = Send slot key (e.g. 'email-send-slot:global' or 'email-send-slot:user123')
 * ARGV[1] = Current timestamp in ms (from application clock)
 * ARGV[2] = Minimum delay in ms between consecutive email dispatches
 * ARGV[3] = Slot key TTL in seconds (e.g. 3600)
 *
 * Returns: targetSlotTimestamp (ms)
 */
const SEND_SLOT_LUA_SCRIPT = `
  local now = tonumber(ARGV[1])
  local delayMs = tonumber(ARGV[2])
  local lastSlot = tonumber(redis.call('GET', KEYS[1]) or '0')
  local targetSlot = math.max(now, lastSlot + delayMs)
  redis.call('SET', KEYS[1], tostring(targetSlot), 'EX', tonumber(ARGV[3]))
  return tostring(targetSlot)
`;

export class RateLimitService {
  /**
   * Helper to compute the current hour slot key and time remaining until the next hour
   */
  public getHourWindowInfo(date = new Date(), senderId = 'global'): {
    key: string;
    msUntilNextHour: number;
    nextHourDate: Date;
  } {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');

    const key = `email-rate:${senderId}:${year}-${month}-${day}T${hour}`;

    // Calculate start of next UTC hour
    const nextHour = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate(), date.getUTCHours() + 1, 0, 0, 0));
    const msUntilNextHour = Math.max(1000, nextHour.getTime() - date.getTime());

    return {
      key,
      msUntilNextHour,
      nextHourDate: nextHour,
    };
  }

  /**
   * Atomically check and increment the hourly email limit across all distributed workers
   */
  public async consumeHourlyQuota(
    customLimit?: number,
    senderId = 'global'
  ): Promise<RateLimitCheckResult> {
    const limit = customLimit && customLimit > 0 ? customLimit : env.MAX_EMAILS_PER_HOUR;
    const { key, msUntilNextHour, nextHourDate } = this.getHourWindowInfo(new Date(), senderId);
    const ttlSeconds = 7200; // 2 hours

    try {
      const result = (await redis.eval(
        RATE_LIMIT_LUA_SCRIPT,
        1,
        key,
        String(limit),
        String(ttlSeconds)
      )) as [number, number];

      const allowed = result[0] === 1;
      const currentCount = result[1];

      if (!allowed) {
        logger.warn('Hourly email rate limit exhausted', {
          senderId,
          key,
          currentCount,
          limit,
          msUntilNextHour,
        });
      }

      return {
        allowed,
        currentCount,
        limit,
        msUntilNextHour,
        nextHourDate,
      };
    } catch (error) {
      logger.error('Redis error during rate limit check, failing open with warning', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback in case of temporary Redis error: allow with current limit
      return {
        allowed: true,
        currentCount: 0,
        limit,
        msUntilNextHour,
        nextHourDate,
      };
    }
  }

  /**
   * Distributed send slot reservation:
   * Guarantees that concurrent workers across any number of server processes
   * dispatch emails with at least `minDelayMs` interval spacing without collisions.
   */
  public async reserveSendSlot(
    minDelayMs?: number,
    senderId = 'global'
  ): Promise<SendSlotResult> {
    const delay = minDelayMs && minDelayMs > 0 ? minDelayMs : env.MIN_EMAIL_DELAY_MS;
    const slotKey = `email-send-slot:${senderId}`;
    const now = Date.now();
    const ttlSeconds = 3600;

    try {
      const targetSlotStr = (await redis.eval(
        SEND_SLOT_LUA_SCRIPT,
        1,
        slotKey,
        String(now),
        String(delay),
        String(ttlSeconds)
      )) as string;

      const targetSlotTimestamp = Number(targetSlotStr);
      const waitTimeMs = Math.max(0, targetSlotTimestamp - Date.now());

      return {
        targetSlotTimestamp,
        waitTimeMs,
      };
    } catch (error) {
      logger.error('Redis error during send slot reservation, using local now', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        targetSlotTimestamp: now,
        waitTimeMs: 0,
      };
    }
  }

  /**
   * Rollback / decrement quota in case of permanent immediate failure before send
   */
  public async rollbackQuota(senderId = 'global'): Promise<void> {
    const { key } = this.getHourWindowInfo(new Date(), senderId);
    try {
      await redis.decr(key);
    } catch (error) {
      logger.error('Failed to rollback rate limit quota', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const rateLimitService = new RateLimitService();
