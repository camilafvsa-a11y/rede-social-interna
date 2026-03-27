import { Platform } from "react-native";

/** Height of the top status/nav bar on web */
export const WEB_TOP = 67;
/** Full bottom clearance on web = safe-area (34) + tab bar (84) */
export const WEB_BOT = 34 + 84;

/** Returns the correct top padding for the current platform */
export function useTopPad(insetTop: number): number {
  return Platform.OS === "web" ? WEB_TOP : insetTop;
}

/** Returns the correct bottom padding for the current platform */
export function useBotPad(insetBottom: number): number {
  return Platform.OS === "web" ? WEB_BOT : insetBottom;
}
