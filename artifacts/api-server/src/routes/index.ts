import { Router, type IRouter } from "express";
import healthRouter from "./health";
import identityProvisioningRouter from "./identityProvisioning";
import sessionCompatibilityRouter from "./sessionCompatibility";
import hierarchyCompatibilityRouter from "./hierarchyCompatibility";
import organizationalHierarchyRouter from "./organizationalHierarchy";
import dataDurabilityRouter from "./dataDurability";
import odontoPortalAuthRouter from "./odontoPortalAuth";
import odontoPortalRouter from "./odontoPortal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(identityProvisioningRouter);
// Must run before hierarchy/auth so Bearer fallback can populate the same
// session token path used by the HttpOnly cookie.
router.use(sessionCompatibilityRouter);
router.use(hierarchyCompatibilityRouter);
// Must run before the legacy auth/admin routes: it establishes hierarchy-aware
// principals and enforces the Creator-only /admin boundary server-side.
router.use(organizationalHierarchyRouter);
// Runs after the principal exists and before the generic state routes so day
// rollover and archive copies are committed server-side first.
router.use(dataDurabilityRouter);
router.use(odontoPortalAuthRouter);
router.use(odontoPortalRouter);

export default router;
