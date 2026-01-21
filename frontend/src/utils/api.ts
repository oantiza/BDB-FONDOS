
/**
 * Unwraps the result from a Cloud Function response.
 * Handles cases where the return value is wrapped in a "result" object
 * (common in Firebase Callable Functions) or returned directly.
 */
export const unwrapResult = <T>(x: any): T => {
    if (x && typeof x === 'object' && 'result' in x) {
        return (x as any).result as T;
    }
    return x as T;
};
