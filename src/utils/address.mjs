import { AppError } from "./app-error.mjs";

const MAX_ADDRESS_LENGTH = 255;

function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeAddressInput(address) {
  if (address === undefined || address === null) return null;

  if (typeof address !== "string") {
    throw new AppError("Address must be a text value.", 422, "INVALID_ADDRESS");
  }

  const normalizedAddress = collapseWhitespace(address);

  if (normalizedAddress === "") return null;

  if (normalizedAddress.length > MAX_ADDRESS_LENGTH) {
    throw new AppError(
      `Address must not exceed ${MAX_ADDRESS_LENGTH} characters.`,
      422,
      "INVALID_ADDRESS"
    );
  }

  return normalizedAddress;
}

function toComparableAddress(address) {
  return typeof address === "string" ? collapseWhitespace(address).toLowerCase() : "";
}

function isSameAddress(firstAddress, secondAddress) {
  const comparableFirstAddress = toComparableAddress(firstAddress);

  return comparableFirstAddress !== "" && comparableFirstAddress === toComparableAddress(secondAddress);
}

export { MAX_ADDRESS_LENGTH, normalizeAddressInput, isSameAddress, collapseWhitespace };
