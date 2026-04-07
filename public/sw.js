// 이전 서비스 워커 제거용 — 새 요청은 모두 네트워크로 직접 전달
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach(c => c.navigate(c.url))
    })()
  )
})
