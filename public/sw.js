// Minimal service worker, registered only so the app can use
// `registration.showNotification()` — the supported way to display a
// notification while the page is backgrounded. The plain `new Notification()`
// constructor is suppressed by Chrome/macOS when the tab isn't in the
// foreground, which is exactly when a nail-biting alert matters most.

// Activate immediately rather than waiting for existing clients to close, so
// notifications work on the first load without a refresh.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);

// Focus an existing app window when the user clicks the notification, opening
// one only if none is already around.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow ? self.clients.openWindow("/") : null;
      })
  );
});
