import userService from "../services/user.service.mjs";
import { success } from "../utils/response.mjs";

async function getProfile(req, res, next) {
  try {
    const user = await userService.getProfile(req.user.id);
    return success(res, 200, "Profile retrieved successfully", user);
  } catch (err) {
    next(err);
  }
}

async function updateHomeAddress(req, res, next) {
  try {
    const { user, geocodeAccuracy, routeRefresh } = await userService.updateHomeAddress(
      req.user.id,
      req.body.homeAddress
    );
    return success(res, 200, "Home address updated successfully", user, { geocodeAccuracy, routeRefresh });
  } catch (err) {
    next(err);
  }
}

async function updateTheme(req, res, next) {
  try {
    const user = await userService.updateTheme(req.user.id, req.body.theme);
    return success(res, 200, "Theme updated successfully", user);
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user.id, { currentPassword, newPassword });
    return success(res, 200, "Password changed successfully");
  } catch (err) {
    next(err);
  }
}

export default { getProfile, updateHomeAddress, updateTheme, changePassword };
