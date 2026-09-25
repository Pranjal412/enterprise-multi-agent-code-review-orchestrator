/**
 * Rate Limiter for API requests and token usage
 * Prevents exceeding Anthropic API rate limits
 *
 * Implements a sliding 60-second window plus a concurrent request limit.
 */

export interface RateLimiterConfig {
  /** Maximum requests per minute */
  maxRequestsPerMinute: number;
  /** Maximum tokens per minute */
  maxTokensPerMinute: number;
  /** Maximum concurrent requests */
  maxConcurrent: number;
}

export const DEFAULT_RATE_LIMITS: RateLimiterConfig = {
  maxRequestsPerMinute: 50,
  maxTokensPerMinute: 100000,
  maxConcurrent: 5
};

interface RequestRecord {
  timestamp: number;
  tokens: number;
}

/**
 * Rate limiter using a sliding 60-second window.
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private requestHistory: RequestRecord[] = [];
  private activeRequests = 0;
  private waitQueue: Array<() => void> = [];

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMITS, ...config };
  }

  /**
   * Acquire permission to make a request.
   */
  async acquire(estimatedTokens: number = 1000): Promise<void> {
    // First wait for a concurrent request slot.
    while (this.activeRequests >= this.config.maxConcurrent) {
      await this.waitForSlot();
    }

    // Then wait for request/token rate limits.
    await this.waitForRateLimit(estimatedTokens);

    this.activeRequests++;

    this.requestHistory.push({
      timestamp: Date.now(),
      tokens: estimatedTokens
    });
  }

  /**
   * Release a request slot after completion.
   */
  release(actualTokens?: number): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);

    // Update the most recent request's token estimate when possible.
    if (actualTokens !== undefined && this.requestHistory.length > 0) {
      const lastRequest =
        this.requestHistory[this.requestHistory.length - 1];

      if (lastRequest) {
        lastRequest.tokens = actualTokens;
      }
    }

    // Wake one waiting request.
    const next = this.waitQueue.shift();

    if (next) {
      next();
    }
  }

  /**
   * Get current rate limit status.
   */
  getStatus(): {
    activeRequests: number;
    requestsInWindow: number;
    tokensInWindow: number;
    availableRequests: number;
    availableTokens: number;
  } {
    this.pruneOldRecords();

    const requestsInWindow = this.requestHistory.length;

    const tokensInWindow = this.requestHistory.reduce(
      (sum, record) => sum + record.tokens,
      0
    );

    return {
      activeRequests: this.activeRequests,
      requestsInWindow,
      tokensInWindow,
      availableRequests: Math.max(
        0,
        this.config.maxRequestsPerMinute - requestsInWindow
      ),
      availableTokens: Math.max(
        0,
        this.config.maxTokensPerMinute - tokensInWindow
      )
    };
  }

  /**
   * Check whether a request can proceed immediately.
   */
  canProceed(estimatedTokens: number = 1000): boolean {
    this.pruneOldRecords();

    if (this.activeRequests >= this.config.maxConcurrent) {
      return false;
    }

    const requestsInWindow = this.requestHistory.length;

    const tokensInWindow = this.requestHistory.reduce(
      (sum, record) => sum + record.tokens,
      0
    );

    if (requestsInWindow >= this.config.maxRequestsPerMinute) {
      return false;
    }

    if (
      tokensInWindow + estimatedTokens >
      this.config.maxTokensPerMinute
    ) {
      return false;
    }

    return true;
  }

  /**
   * Wait for a concurrent request slot.
   */
  private async waitForSlot(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Wait until the sliding-window rate limits allow the request.
   */
  private async waitForRateLimit(
    estimatedTokens: number
  ): Promise<void> {
    while (!this.canProceed(estimatedTokens)) {
      this.pruneOldRecords();

      if (this.requestHistory.length === 0) {
        break;
      }

      const oldestRequest = this.requestHistory[0];

      if (!oldestRequest) {
        break;
      }

      const expirationTime = oldestRequest.timestamp + 60000;
      const now = Date.now();

      const waitTime = expirationTime - now + 100;

      const delay = Math.min(
        Math.max(100, waitTime),
        5000
      );

      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }

  /**
   * Remove requests older than 60 seconds.
   */
  private pruneOldRecords(): void {
    const cutoff = Date.now() - 60000;

    this.requestHistory = this.requestHistory.filter(
      (record) => record.timestamp > cutoff
    );
  }
}

/**
 * Wrap an async operation with rate limiting.
 */
export function withRateLimit<T>(
  rateLimiter: RateLimiter,
  fn: () => Promise<T>,
  estimatedTokens: number = 1000
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    let acquired = false;

    try {
      await rateLimiter.acquire(estimatedTokens);
      acquired = true;

      const result = await fn();

      rateLimiter.release();
      resolve(result);
    } catch (error) {
      if (acquired) {
        rateLimiter.release();
      }

      reject(error);
    }
  });
}

/**
 * Global rate limiter instance.
 */
export const globalRateLimiter = new RateLimiter();
