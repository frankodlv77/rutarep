// Push notification handler — importado por el SW generado por workbox
self.addEventListener('push', event => {
  if (!event.data) return
  const { title, body } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title || 'RutaRep', {
      body:     body || '',
      icon:     '/icon-192.png',
      badge:    '/icon-192.png',
      vibrate:  [100, 50, 100],
      tag:      'rutarep',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        for (const client of list) {
          if ('focus' in client) return client.focus()
        }
        return self.clients.openWindow('/')
      })
  )
})
