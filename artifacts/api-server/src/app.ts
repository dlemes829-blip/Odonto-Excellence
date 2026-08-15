import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  enforceTrustedOrigin,
  reportCorsConfiguration,
  securityHeaders,
  trustedPortalOrigins,
} from "./middlewares/httpSecurity";

const app: Express = express();
app.disable("x-powered-by");
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
        return { statusCode: res.statusCode };
      },
    },
  }),
);

const portalOrigins = trustedPortalOrigins();
reportCorsConfiguration();
app.use(
  cors({
    origin: portalOrigins.length ? portalOrigins : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 600,
  }),
);
app.use(securityHeaders);
app.use(enforceTrustedOrigin);
app.use(express.json({ limit: "1.1mb" }));
app.use(express.urlencoded({ extended: true, limit: "32kb" }));
app.use(cookieParser());

app.use("/api", router);

export default app;
