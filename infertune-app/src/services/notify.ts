import { useSettingsStore } from "../store/settingsStore";

/**
 * Shows a desktop notification when a long job finishes, but only if the
 * user turned them on and is not looking at the window. Never throws.
 */
export async function notifyDone(title: string, body: string): Promise<void> {
  try {
    if (!useSettingsStore.getState().notificationsEnabled) return;
    if (typeof document !== "undefined" && document.hasFocus()) return;

    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification");

    let granted = await isPermissionGranted();

    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }

    if (granted) sendNotification({ title, body });
  } catch {
    // Notifications are optional.
  }
}
