import app from "../artifacts/api-server/src/app";

// Vercel adapts the exported Express application into a Node.js Function.
// Keeping the original Express app means authorization, CORS, cookies and
// every /api route use the exact same production code as the Render service.
// The function region is pinned in vercel.json beside this entrypoint.
export default app;
