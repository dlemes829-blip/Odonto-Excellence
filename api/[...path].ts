import app from "../artifacts/api-server/src/app";

// Vercel adapts the exported Express application into a Node.js Function.
// Keeping the original Express app means authorization, CORS, cookies and
// every /api route use the exact same production code as the Render service.
export default app;
