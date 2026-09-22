// Minimal service worker whose only job is to receive push events (even when
// no tab is open) and show a notification, plus handle a click on it.
// Deliberately does not do any caching/offline work - that's out of scope.

self.addEventListener("push", (event) => {
  let data = { title: "AI Personal Assistant", body: "You have an update.", tag: "generic" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // If the payload isn't valid JSON for some reason, fall back to the generic message above.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: data.icon,
      data: { url: data.url || "/schedule" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/schedule";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
