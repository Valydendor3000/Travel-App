import React, { useState } from "react";
import BrandSocials from "./pages/BrandSocials";
import TripsEditor from "./pages/TripsEditor";

export default function App() {
  const [tab, setTab] = useState<"home"|"socials"|"trips">("trips");
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button onClick={()=>setTab("home")}>Home</button>
        <button onClick={()=>setTab("socials")}>Brand Socials</button>
        <button onClick={()=>setTab("trips")}>Trips</button>
      </header>
      {tab === "home" && <p>Welcome to TripStack Admin.</p>}
      {tab === "socials" && <BrandSocials/>}
      {tab === "trips" && <TripsEditor/>}
    </main>
  );
}
