const DAILY_LIMIT_PER_USER = 50;
const GLOBAL_DAILY_LIMIT = 500;

interface QuotaBucket {
  count: number;
  resetAt: number;
}

const userBuckets = new Map<string, QuotaBucket>();
let globalBucket: QuotaBucket = { count: 0, resetAt: nextMidnight() };

function nextMidnight(): number {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  return midnight.getTime();
}

function getBucket(map: Map<string, QuotaBucket>, key: string): QuotaBucket {
  const now = Date.now();
  let bucket = map.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: nextMidnight() };
    map.set(key, bucket);
  }
  return bucket;
}

function getGlobalBucket(): QuotaBucket {
  const now = Date.now();
  if (now >= globalBucket.resetAt) {
    globalBucket = { count: 0, resetAt: nextMidnight() };
  }
  return globalBucket;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
}

export function checkAndConsumeQuota(userId: string): QuotaCheckResult {
  const global = getGlobalBucket();
  if (global.count >= GLOBAL_DAILY_LIMIT) {
    return {
      allowed: false,
      reason:
        "Daily AI generation limit reached for the service. Please try again tomorrow.",
    };
  }

  const user = getBucket(userBuckets, userId);
  if (user.count >= DAILY_LIMIT_PER_USER) {
    return {
      allowed: false,
      reason: `You have reached your daily AI generation limit (${DAILY_LIMIT_PER_USER} requests). Please try again tomorrow.`,
      remaining: 0,
    };
  }

  global.count += 1;
  user.count += 1;

  return {
    allowed: true,
    remaining: DAILY_LIMIT_PER_USER - user.count,
  };
}
