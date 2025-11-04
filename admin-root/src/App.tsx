import React, { useState } from "react";
import BrandSocials from "./pages/BrandSocials";
import TripsEditor from "./pages/TripsEditor";

// 🎨 Theme colors (easy to swap per brand)
const theme = {
  primary: "#0ea5e9", // cyan
  background: "#f8fafc", // light gray
  surface: "#ffffff",
  text: "#0f172a",
  accent: "#0284c7"
};

export default function App() {
  const [tab, setTab] = useState<"home" | "socials" | "trips">("trips");

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", background: theme.background, minHeight: "100vh" }}>
      {/* Header bar */}
      <header
        style={{
          background: theme.primary,
          color: "white",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 20 }}>TripStack Admin</div>
        <nav style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => setTab("home")}
            style={navButton(tab === "home", theme)}
          >
            Home
          </button>
          <button
            onClick={() => setTab("socials")}
            style={navButton(tab === "socials", theme)}
          >
            Brand Socials
          </button>
          <button
            onClick={() => setTab("trips")}
            style={navButton(tab === "trips", theme)}
          >
            Trips
          </button>
        </nav>
      </header>

      {/* Main content */}
      <main style={{ padding: "24px", color: theme.text }}>
        {tab === "home" && (
          <div>
            <h1>Welcome to TripStack Admin</h1>
            <p>
              Use the navigation above to manage brand socials and trip data.
            </p>
          </div>
        )}
        {tab === "socials" && <BrandSocials />}
        {tab === "trips" && <TripsEditor />}
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "12px",
          fontSize: 13,
          color: "#64748b",
        }}
      >
        © {new Date().getFullYear()} TripStack Platform
      </footer>
    </div>
  );
}

// 🧩 Reusable button style helper
function navButton(active: boolean, theme: any) {
  return {
    background: active ? "white" : theme.accent,
    color: active ? theme.accent : "white",
    border: "none",
    padding: "6px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.2s",
    boxShadow: active ? "inset 0 0 4px rgba(0,0,0,0.1)" : "none",
  };
}
