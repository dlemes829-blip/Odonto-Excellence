import { Router, type IRouter } from "express";
import healthRouter from "./health";
import odontoPortalAuthRouter from "./odontoPortalAuth";
import odontoPortalRouter from "./odontoPortal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(odontoPortalAuthRouter);
router.use(odontoPortalRouter);

export default router;
