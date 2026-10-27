import bcrypt from "bcryptjs";
import userModel from "../models/user.model.mjs";
import { AppError } from "../utils/app-error.mjs";
import { isSameAddress, normalizeAddressInput } from "../utils/address.mjs";
import { geocodeAddress } from "./geocoding.service.mjs";
import { getHomeLocation } from "./route-enrichment.service.mjs";
import { queueRouteRefresh } from "./route-refresh.service.mjs";
import authService from "./auth.service.mjs";

async function getProfile(userId) {
  const user = await userModel.findById(userId);
  return authService.sanitizeUser(user);
}

async function updateHomeAddress(userId, homeAddress) {
  const normalizedAddress = normalizeAddressInput(homeAddress);

  if (!normalizedAddress) {
    throw new AppError("Home address is required.", 422, "INVALID_ADDRESS");
  }

  const currentUser = await userModel.findById(userId);

  if (isSameAddress(currentUser.homeAddress, normalizedAddress) && getHomeLocation(currentUser)) {
    return { user: authService.sanitizeUser(currentUser), geocodeAccuracy: null, routeRefresh: "skipped" };
  }

  const { lat, lng, accuracy } = await geocodeAddress(normalizedAddress);
  const user = await userModel.update(userId, {
    homeAddress: normalizedAddress,
    homeLat: lat,
    homeLng: lng,
  });

  const routeRefresh = queueRouteRefresh(userId);

  return { user: authService.sanitizeUser(user), geocodeAccuracy: accuracy, routeRefresh };
}

async function updateTheme(userId, theme) {
  if (!["light", "dark"].includes(theme)) {
    throw new AppError("Theme must be either 'light' or 'dark'.", 422, "INVALID_THEME");
  }

  const user = await userModel.update(userId, { theme });
  return authService.sanitizeUser(user);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await userModel.findById(userId);

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new AppError("Current password is incorrect.", 401, "INVALID_CURRENT_PASSWORD");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await userModel.update(userId, { password: hashedPassword });
}

export default { getProfile, updateHomeAddress, updateTheme, changePassword };
