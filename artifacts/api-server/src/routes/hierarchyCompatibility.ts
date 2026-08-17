import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * Compatibility boundary for the hierarchy UI.
 * Keep request normalization here so the authorization routes receive one
 * canonical contract and never need to infer privileges from client quirks.
 */
router.patch("/odonto-portal/hierarchy/team/users/:id", (req, _res, next) => {
  if (
    req.body &&
    typeof req.body === "object" &&
    typeof req.body.isActive === "boolean" &&
    typeof req.body.accountStatus !== "string"
  ) {
    req.body.accountStatus = req.body.isActive ? "active" : "suspended";
  }
  next();
});

router.post("/odonto-portal/hierarchy/admin/link-person", (req, _res, next) => {
  if (
    req.body &&
    typeof req.body === "object" &&
    typeof req.body.secondaryUserId !== "string" &&
    typeof req.body.linkedUserId === "string"
  ) {
    req.body.secondaryUserId = req.body.linkedUserId;
  }
  next();
});

export default router;
