import React, { useEffect, useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function BrandSocials() {
  const [brandId, setBrandId] = useState("b1");
  const [form, setForm] = useState({ facebook_url:"", instagram_url:"", twitter_url:"", tiktok_url:"" });
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await fetch(`${API_BASE}/api/brands/${brandId}/socials`);
    const j = await r.json();
    setForm({
      facebook_url: j.facebook_url || "",
      instagram_url: j.instagram_url || "",
      twitter_url: j.twitter_url || "",
      tiktok_url: j.tiktok_url || "",
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const isHttps = (s:string) => !s || /^https:\/\/[^ ]+$/i.test(s);
    if (![form.facebook_url, form.instagram_url, form.twitter_url, form.tiktok_url].every(isHttps)) {
      setMsg("Please use full https:// URLs"); return;
    }
    const r = await fetch(`${API_BASE}/api/brands/${brandId}/socials`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
    });
    const j = await r.json(); setMsg(r.ok ? "Saved!" : (j.error || "Failed"));
  }

  useEffect(()=>{ load(); }, [brandId]);

  const field = (name: keyof typeof form, label: string) => (
    <label>{label}<input value={form[name]} onChange={e=>setForm({...form, [name]: e.target.value})} /></label>
  );

  return (
    <main style={{ padding: 24 }}>
      <h1>Brand Socials</h1>
      <p>API: <code>{API_BASE}</code></p>
      <label>Brand ID <input value={brandId} onChange={e=>setBrandId(e.target.value)} /></label>
      <form onSubmit={save} style={{ display: "grid", gap: 8, maxWidth: 520, marginTop: 16 }}>
        {field("facebook_url","Facebook URL")}
        {field("instagram_url","Instagram URL")}
        {field("twitter_url","Twitter/X URL")}
        {field("tiktok_url","TikTok URL")}
        <button>Save</button>
        {msg && <div>{msg}</div>}
      </form>
    </main>
  );
}
