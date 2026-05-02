export class RequestCache {
    private cache: Map<string, { data: any; expiry: number }> = new Map();
    private activeRequests: Map<string, Promise<any>> = new Map();
    private ttl: number;

    constructor(ttlMinutes: number = 5) {
        this.ttl = ttlMinutes * 60 * 1000;
    }

    private generateKey(fnName: string, args: any): string {
        return `${fnName}_${JSON.stringify(args)}`;
    }

    async getOrFetch<T>(fnName: string, args: any, fetcher: () => Promise<T>): Promise<T> {
        const key = this.generateKey(fnName, args);

        // 1. Check cache
        const item = this.cache.get(key);
        if (item && Date.now() <= item.expiry) {
            return item.data;
        }

        // 2. Check active requests (deduplication)
        if (this.activeRequests.has(key)) {
            return this.activeRequests.get(key) as Promise<T>;
        }

        // 3. Fetch and store
        const promise = fetcher().then((data) => {
            this.cache.set(key, { data, expiry: Date.now() + this.ttl });
            this.activeRequests.delete(key);
            return data;
        }).catch((err) => {
            this.activeRequests.delete(key);
            throw err;
        });

        this.activeRequests.set(key, promise);
        return promise;
    }

    clear() {
        this.cache.clear();
        this.activeRequests.clear();
    }
}

export const globalApiCache = new RequestCache(10); // 10 minutes cache
