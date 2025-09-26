export class LoadBalancer<T> {
  private registry: T[];

  constructor(apiKeys: string[], factory: (key: string) => T) {
    this.registry = apiKeys.map(factory);
  }

  getRandom(): T {
    if (this.registry.length === 0) {
      throw new Error(`没有可用的 API 密钥`);
    }
    const randomIndex = Math.floor(Math.random() * this.registry.length);
    return this.registry[randomIndex];
  }
}