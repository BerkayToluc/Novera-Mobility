// The current time, read once per request by server pages. Kept apart so a page's render
// stays free of direct clock reads, and so a test can stand in for it.
export const currentTime = () => Date.now();
