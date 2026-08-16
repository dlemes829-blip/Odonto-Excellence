import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  helmet({
    // The frontend is a separate origin/app; a strict default CSP here
    // would break it without coordinated configuration, so it's left to
    // the frontend's own hosting layer for now.
    contentSecurityPolicy: false,
  }),
);

const portalOrigin = process.env.PORTAL_ORIGIN;
const portalOrigins = (process.env.PORTAL_ORIGINS ?? portalOrigin ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && portalOrigins.length === 0) {
  // Fail loudly instead of silently reflecting every origin. Reflecting
  // "true" as the CORS origin while credentials:true is enabled lets ANY
  // website issue authenticated requests using a logged-in visitor's
  // session cookie against this API - a critical vulnerability. If the
  // real production domain isn't configured yet, cross-origin requests
  // must be refused rather than allowed from everywhere.
  logger.error(
    "PORTAL_ORIGIN(S) is not set in production. Cross-origin requests will be refused until it is configured.",
  );
}

app.use(
  cors({
    origin: isProduction
      ? portalOrigins
      : portalOrigins.length
        ? portalOrigins
        : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use("/api", router);

export default app;
