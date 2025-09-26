// 增加一个 Promise 链来串行化速率限制检查
export class ConcurrencyLimiter {
  private _queue: (() => void)[] = [];
  private _running = 0;
  private _requestTimestamps: number[] = [];
  // 新增一个 promise 链，确保 _waitForRateLimit 调用是串行的
  private _rateLimitChain: Promise<any> = Promise.resolve();

  constructor(
    private concurrency: number,
    private requestsPerMinute: number = Infinity,
    private minIntervalMs: number = 0,
  ) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrapped = async () => {
        try {
          // 在这里串行化速率限制的等待
          await this._enqueueRateLimitCheck();
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

  // 将速率限制检查放入一个 Promise 链中
  private _enqueueRateLimitCheck(): Promise<void> {
    const previous = this._rateLimitChain;
    this._rateLimitChain = previous.then(() => this._waitForRateLimit());
    return this._rateLimitChain;
  }

  // _waitForRateLimit 现在可以假设自己是串行调用的，无需担心竞态条件
  private async _waitForRateLimit(): Promise<void> {
    // 因为调用是串行的，所以这里的逻辑变得安全了

    // 1. 处理每分钟请求数限制
    if (this.requestsPerMinute !== Infinity) {
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;
      this._requestTimestamps = this._requestTimestamps.filter(
        (timestamp) => timestamp > oneMinuteAgo,
      );

      if (this._requestTimestamps.length >= this.requestsPerMinute) {
        const oldestRequestTime = this._requestTimestamps[0];
        const timeToWait = (oldestRequestTime + 60 * 1000) - now;
        if (timeToWait > 0) {
          await new Promise((resolve) => setTimeout(resolve, timeToWait));
        }
      }
    }

    // 2. 处理最小间隔
    if (this.minIntervalMs > 0) {
      const lastRequestTime = this._requestTimestamps.length > 0
        ? this._requestTimestamps[this._requestTimestamps.length - 1]
        : 0;
      const timeSinceLastRequest = Date.now() - lastRequestTime;

      if (timeSinceLastRequest < this.minIntervalMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.minIntervalMs - timeSinceLastRequest),
        );
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