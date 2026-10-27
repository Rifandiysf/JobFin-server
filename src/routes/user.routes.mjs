import express from "express";
import userController from "../controllers/user.controller.mjs";
import authGuard from "../middlewares/auth.middleware.mjs";
import { homeAddressLimiter } from "../middlewares/rate-limit.middleware.mjs";

const router = express.Router();

router.use(authGuard);

router.get("/me", userController.getProfile);
router.put("/me/home-address", homeAddressLimiter, userController.updateHomeAddress);
router.put("/me/theme", userController.updateTheme);
router.put("/me/change-password", userController.changePassword);

export default router;
