export class ConcurrencyLimiter {
  private _queue: (() => void)[] = [];
  private _running = 0;
  private _requestTimestamps: number[] = [];

  constructor(
    private concurrency: number,
    private requestsPerMinute: number = Infinity,
    private minIntervalMs: number = 0,
  ) {}

  async run<T>(task: () =>Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrapped = async () => {
        try {
          await this._waitForRateLimit();
          const result = await task();
          resolve(result);
        } catch (e) {
          reject(e);
        } finally {
          this._running--;
          this._processQueue();
        }
      };

      if (this._running < this.concurrency) {
        this._running++;
        wrapped();
      } else {
        this._queue.push(wrapped);
      }
    });
  }

  private async _waitForRateLimit(): Promise<void> {
    const now = Date.now();

    // Enforce minimum interval between requests
    if (this.minIntervalMs > 0) {
      const lastRequestTime = this._requestTimestamps[this._requestTimestamps.length - 1] || 0;
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < this.minIntervalMs) {
        await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - timeSinceLastRequest));
      }
    }

    // Enforce requests per minute limit
    if (this.requestsPerMinute !== Infinity) {
      const oneMinuteAgo = now - 60 * 1000;
      this._requestTimestamps = this._requestTimestamps.filter((timestamp) => timestamp > oneMinuteAgo);

      if (this._requestTimestamps.length >= this.requestsPerMinute) {
        const oldestRequestTime = this._requestTimestamps[0];
        const timeToWait = oldestRequestTime - oneMinuteAgo;
        if (timeToWait > 0) {
          await new Promise((resolve) => setTimeout(resolve, timeToWait));
        }
        // After waiting, re-filter and check again in case other requests completed
        this._requestTimestamps =this._requestTimestamps.filter((timestamp) => timestamp > oneMinuteAgo);
      }
    }
    this._requestTimestamps.push(Date.now());
  }

  private _processQueue(): void {
   if (this._queue.length > 0 && this._running < this.concurrency) {
      const nextWrapped = this._queue.shift()!;
      this._running++;
      nextWrapped();
    }
  }
}