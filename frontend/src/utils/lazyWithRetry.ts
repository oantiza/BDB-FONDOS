import { lazy, ComponentType } from 'react';

export const lazyWithRetry = <T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>
) => {
    return lazy(async () => {
        try {
            return await factory();
        } catch (error: any) {
            console.error("Lazy load failed (chunk missing?), reloading page...", error);
            // If the chunk is missing (404), it usually means a new version was deployed.
            // Reloading the page will fetch the new index.html with correct chunk hashes.
            // We use sessionStorage to prevent an infinite loop in case the error is persistent (e.g. valid 404).
            const key = `lazy_retry_${window.location.pathname}`;
            const retried = sessionStorage.getItem(key);

            if (!retried) {
                sessionStorage.setItem(key, 'true');
                window.location.reload();
                return new Promise(() => { }); // Wait for reload
            }

            // If already retried, clear flag and throw (don't loop)
            sessionStorage.removeItem(key);
            throw error;
        }
    });
};
