export type MetricsServicePort = {
    increment(metric: 'transfer_created' | 'transfer_failed' | 'breb_calls' | 'breb_errors'): Promise<void>;
    getMetrics(): Promise<{
        transfer_created: number;
        transfer_failed: number;
        breb_calls: number;
        breb_errors: number;
    }>;
};