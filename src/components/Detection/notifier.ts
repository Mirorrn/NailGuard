/**
 * Thin wrapper around the Web Notifications API for surfacing bite alerts
 * outside the BiteAlert window (when it's unfocused, behind another window, or
 * sound is muted). Notifications appear at the OS level regardless of focus.
 *
 * Permission must be requested from a user gesture, so the hook exposes
 * `requestNotificationPermission` for a button to call.
 */

export type NotificationPermissionState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export function getPermissionState(): NotificationPermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

export async function requestPermission(): Promise<NotificationPermissionState> {
  if (typeof Notification === "undefined") {
    console.warn(
      "[BiteAlert] Notifications unavailable: the Notification API is not " +
        "present. This usually means the page isn't in a secure context " +
        "(serve over https:// or http://localhost, not file:// or a LAN IP)."
    );
    return "unsupported";
  }
  // Secure-context guard: in an insecure context Notification may exist but
  // requestPermission() silently does nothing. Surface that instead.
  if (typeof isSecureContext !== "undefined" && !isSecureContext) {
    console.warn(
      "[BiteAlert] Notifications blocked: page is not a secure context. " +
        "Open it via http://localhost (not a 192.168.x.x address or file://)."
    );
    return "unsupported";
  }
  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch {
    // Older Safari used a callback-only signature; treat failure as denied.
    return getPermissionState();
  }
}

/**
 * Show a notification, preferring the Service Worker path when one is
 * registered. This matters on Chrome/macOS: the plain `new Notification()`
 * constructor only displays a banner while the page is the *foreground* tab —
 * in the background it silently no-ops. `registration.showNotification()` is
 * the supported way to surface a notification while backgrounded. Falls back to
 * the constructor (and logs the limitation) when no SW is available.
 *
 * Returns the constructed `Notification` when the fallback path is used (so the
 * caller can `.close()` it), or `null` for the SW path / on failure.
 */
async function show(title: string, body: string): Promise<Notification | null> {
  const options: NotificationOptions = {
    body,
    tag: "bitealert-bite", // collapses repeats into one slot
    silent: true, // audio is handled separately by the in-app player
  };

  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (reg) {
    try {
      await reg.showNotification(title, options);
      console.debug("[BiteAlert] Notification shown via service worker.");
      return null;
    } catch (cause) {
      console.warn("[BiteAlert] SW showNotification failed:", cause);
    }
  }

  // Constructor fallback. Warn when we're backgrounded, since the banner will
  // likely not appear (no SW registered to take the supported path).
  if (document.visibilityState !== "visible") {
    console.warn(
      "[BiteAlert] Showing a notification from the background without a " +
        "service worker — Chrome/macOS may suppress the banner. (No SW is " +
        "registered for this app.)"
    );
  }
  try {
    const note = new Notification(title, options);
    note.onclick = () => {
      window.focus();
      note.close();
    };
    note.onerror = (e) =>
      console.warn("[BiteAlert] Notification error event:", e);
    console.debug("[BiteAlert] Notification constructed (foreground path).");
    return note;
  } catch (cause) {
    console.warn("[BiteAlert] Notification construction failed:", cause);
    return null;
  }
}

/**
 * Fires bite notifications, replacing any still-showing one (via a stable tag)
 * and rate-limiting so a flurry of bites doesn't stack a wall of popups.
 */
export function createBiteNotifier(minIntervalMs: number) {
  let lastFiredAt = -Infinity;

  return {
    /** `now` is a monotonic timestamp (ms), e.g. the rAF/inference timestamp. */
    fire(now: number) {
      const permission = getPermissionState();
      if (permission !== "granted") {
        console.debug(
          `[BiteAlert] Notification skipped: permission is "${permission}".`
        );
        return;
      }
      if (now - lastFiredAt < minIntervalMs) return;
      lastFiredAt = now;

      // The `tag` collapses repeats into one OS slot, so there's no separate
      // handle to track/close here.
      void show("✋ Nail biting detected", "Hands away from your mouth!");
    },

    /**
     * One-off confirmation shown right after the user grants permission, to
     * prove the pipeline works end-to-end (and reveal that focused-window
     * banners may be suppressed by the OS). Bypasses the rate limit.
     */
    confirm() {
      if (getPermissionState() !== "granted") return;
      void show(
        "🔔 Alerts enabled",
        "You’ll get a heads-up here when nail biting is detected."
      );
    },
  };
}
