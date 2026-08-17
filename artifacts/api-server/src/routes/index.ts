import { Router, type IRouter } from "express";
import healthRouter from "./health";
import identityProvisioningRouter from "./identityProvisioning";
import hierarchyCompatibilityRouter from "./hierarchyCompatibility";
import organizationalHierarchyRouter from "./organizationalHierarchy";
import odontoPortalAuthRouter from "./odontoPortalAuth";
import odontoPortalRouter from "./odontoPortal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(identityProvisioningRouter);
router.use(hierarchyCompatibilityRouter);
// Must run before the legacy auth/admin routes: it establishes hierarchy-aware
// principals and enforces the Creator-only /admin boundary server-side.
router.use(organizationalHierarchyRouter);
router.use(odontoPortalAuthRouter);
router.use(odontoPortalRouter);

export default router;
