import express from "express";
import jobController from "../controllers/job.controller.mjs";
import authGuard from "../middlewares/auth.middleware.mjs";
import { jobWriteLimiter, routeRefreshLimiter } from "../middlewares/rate-limit.middleware.mjs";

const router = express.Router();

router.use(authGuard);

router.post("/", jobWriteLimiter, jobController.create);
router.get("/", jobController.list);
router.get("/:id", jobController.detail);
router.put("/:id", jobWriteLimiter, jobController.update);
router.post("/:id/refresh-route", routeRefreshLimiter, jobController.refreshRoute);
router.delete("/:id", jobController.remove);

export default router;
