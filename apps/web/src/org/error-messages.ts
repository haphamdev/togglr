import { ApiError } from "../api/client";

/** Friendly, user-facing text for the opaque animal error codes. */
const MESSAGES: Record<string, string> = {
  FUNNY_PIG: "That organization slug is already taken.",
  CLUMSY_OWL: "Please check the form and try again.",
  SLEEPY_DOG: "That project key is already used in this organization.",
  NOISY_DUCK: "That environment key is already used in this project.",
  COZY_BEE: "That email already belongs to this organization.",
  BUSY_BEE: "A pending invite for this email already exists.",
  HAPPY_BEE: "This invite has already been used.",
  LONELY_RAM: "You can't demote or remove the only remaining owner.",
  SNEAKY_OWL: "You don't have permission to do that.",
  LONELY_OWL: "You're not a member of this organization.",
  LOST_OWL: "That item no longer exists.",
  LOST_BEE: "This invite link is invalid.",
  TIRED_BEE: "This invite has expired.",
  SHY_FOX: "Please choose a password to create your account.",
  PUZZLED_FOX: "You're signed in as a different user than this invite is for.",
  GRUMPY_OWL: "Your session expired. Please refresh and try again.",
  DIZZY_OWL: "Service is temporarily unavailable. Please try again.",
};

/** Map any thrown error to a friendly message, or null when there is no error. */
export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return MESSAGES[error.code] ?? "Something went wrong.";
  return "Something went wrong. Please try again.";
}
