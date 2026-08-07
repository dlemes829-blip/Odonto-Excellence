import { Router, type IRouter } from "express";
import healthRouter from "./health";
import odontoPortalRouter from "./odontoPortal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(odontoPortalRouter);

export default router;
