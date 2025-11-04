import React, { useState } from 'react'

export default function App() {
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_BASE || '')
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>TripStack Admin</h1>
      <p>Connected API: <code>{apiUrl}</code></p>
      <section>
        <h2>Brands</h2>
        <p>Upload logos and set colors here (placeholder).</p>
      </section>
    </main>
  )
}
