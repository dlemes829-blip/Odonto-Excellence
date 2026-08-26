import { Router, type IRouter } from "express";
import healthRouter from "./health";
import identityProvisioningRouter from "./identityProvisioning";
import sessionCompatibilityRouter from "./sessionCompatibility";
import hierarchyCompatibilityRouter from "./hierarchyCompatibility";
import organizationalHierarchyRouter from "./organizationalHierarchy";
import dataDurabilityRouter from "./dataDurability";
import odontoPortalAuthRouter from "./odontoPortalAuth";
import appointmentOperationsRouter from "./appointmentOperations";
import managementDayArchiveRouter from "./managementDayArchive";
import managementSpreadsheetImportRouter from "./managementSpreadsheetImport";
import managementControlRouter from "./managementControl";
import trainingMetadataFastRouter from "./trainingMetadataFast";
import trainingAgentSecureRouter from "./trainingAgentSecure";
import odontoPortalRouter from "./odontoPortal";
import trainingAgentRouter from "./trainingAgent";

const router: IRouter = Router();

router.use(healthRouter);
// Day archival overrides bootstrap/action handling before the generic public
// management routes so excluded dates disappear without destroying stored data.
router.use(managementDayArchiveRouter);
// Spreadsheet import has a dedicated validated route and runs before the
// generic management router so large reconciliations remain isolated.
router.use(managementSpreadsheetImportRouter);
// Public, loginless management control is intentionally mounted before the
// portal-authenticated routes and uses its own origin/rate controls.
router.use(managementControlRouter);
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
// Evaluation writes are atomic and mounted before the generic document route.
// This prevents a concurrent state refresh from dropping a newly saved patient.
router.use(appointmentOperationsRouter);
// Fast/hardened endpoints intentionally mount before their legacy equivalents.
// They own the response and avoid the slower full-document implementations.
router.use(trainingMetadataFastRouter);
router.use(trainingAgentSecureRouter);
router.use(trainingAgentRouter);
router.use(odontoPortalRouter);

export default router;
