import React, { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export default function App() {
  const [status, setStatus] = useState<string>('checking…')
  useEffect(() => {
    if (!API_BASE) { setStatus('Set VITE_API_BASE in Pages settings'); return }
    fetch(`${API_BASE}/health`).then(r => r.json()).then(
      j => setStatus(j.ok ? '✅ API reachable' : '⚠️ Unexpected response'),
      e => setStatus('❌ Cannot reach API')
    )
  }, [])

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>TripStack Admin</h1>
      <p>API: <code>{API_BASE || '(not set)'}</code></p>
      <p>Status: {status}</p>
      <section style={{marginTop: 16}}>
        <h2>Quick Links</h2>
        <ul>
          <li><a href={`${API_BASE}/api/trips`} target="_blank">GET /api/trips</a></li>
          <li><a href={`${API_BASE}/api/groups/g1/payments`} target="_blank">GET /api/groups/g1/payments</a></li>
        </ul>
      </section>
    </main>
  )
}
