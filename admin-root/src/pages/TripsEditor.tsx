import React, { useEffect, useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function TripsEditor() {
  const [groupId, setGroupId] = useState("g1");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    const r = await fetch(`${API_BASE}/api/trips?groupId=${encodeURIComponent(groupId)}`);
    setRows(await r.json());
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [groupId]);

  function edit(row:any) {
    setId(row.id);
    setTitle(row.title || "");
    setStart(row.start_date ? new Date(row.start_date*1000).toISOString().slice(0,10) : "");
    setEnd(row.end_date ? new Date(row.end_date*1000).toISOString().slice(0,10) : "");
    setNotes(row.notes || "");
  }

  function resetForm() { setId(null); setTitle(""); setStart(""); setEnd(""); setNotes(""); setMsg(null); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const start_date = start ? Math.floor(new Date(start).getTime()/1000) : undefined;
    const end_date = end ? Math.floor(new Date(end).getTime()/1000) : undefined;
    try {
      if (!id) {
        const r = await fetch(`${API_BASE}/api/trips`, {
          method: "POST", headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ group_id: groupId, title, start_date, end_date, notes })
        });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || "Create failed");
      } else {
        const r = await fetch(`${API_BASE}/api/trips/${id}`, {
          method: "PUT", headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ group_id: groupId, title, start_date, end_date, notes })
        });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || "Update failed");
      }
      resetForm(); await load(); setMsg("Saved!");
    } catch (err:any) { setMsg(err.message); } finally { setBusy(false); }
  }

  async function del(row:any) {
    if (!confirm(`Delete "${row.title}"?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/trips/${row.id}`, { method: "DELETE" });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "Delete failed");
      if (id === row.id) resetForm();
      await load();
    } catch (e:any) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Trips</h1>
      <p>API: <code>{API_BASE}</code></p>

      <label>Group ID&nbsp;<input value={groupId} onChange={e=>setGroupId(e.target.value)} /></label>

      <form onSubmit={submit} style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 560 }}>
        <h2>{id ? "Edit trip" : "Create trip"}</h2>
        <label>Title <input required value={title} onChange={e=>setTitle(e.target.value)} /></label>
        <label>Start date <input type="date" value={start} onChange={e=>setStart(e.target.value)} /></label>
        <label>End date <input type="date" value={end} onChange={e=>setEnd(e.target.value)} /></label>
        <label>Notes <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} /></label>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={busy}>{busy ? "Saving..." : (id ? "Update" : "Create")}</button>
          {id && <button type="button" onClick={resetForm}>Cancel</button>}
        </div>
        {msg && <div>{msg}</div>}
      </form>

      <h2 style={{ marginTop: 24 }}>Existing trips</h2>
      <ul>
        {rows.map(r => (
          <li key={r.id} style={{ margin: "6px 0" }}>
            <strong>{r.title}</strong>
            {r.start_date ? ` — ${new Date(r.start_date*1000).toLocaleDateString()}` : ""}
            <button style={{ marginLeft: 8 }} onClick={()=>edit(r)}>Edit</button>
            <button style={{ marginLeft: 8 }} onClick={()=>del(r)}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
