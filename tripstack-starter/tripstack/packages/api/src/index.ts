export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- CORS ---
    const CORS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Cache-Control": "no-store",
    };

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...CORS },
      });

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    // --- Healthcheck ---
    if (url.pathname === "/health") return json({ ok: true });

    // --- Sanity: D1 binding present? ---
    if (!env.DB) {
      return json(
        {
          error:
            "D1 binding 'DB' is missing. Add a D1 Database binding named DB in Workers → Settings → Bindings.",
        },
        500
      );
    }

    // ================================================================
    // Helpers
    // ================================================================
    const ok = () => ({ ok: true });

    const nowSec = () => Math.floor(Date.now() / 1000);
    const readJson = async (req) => req.json().catch(() => ({}));

    const requireAdmin = (req) => {
      const auth = req.headers.get("authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      return token && token === env.ADMIN_TOKEN;
    };

    const isAdminRequest = (req) => requireAdmin(req);

    const idGen = () =>
      crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    const to01 = (v) => {
      if (v === undefined) return null; // "no change"
      if (v === true || v === 1 || v === "1" || v === "true") return 1;
      if (v === false || v === 0 || v === "0" || v === "false") return 0;
      return null;
    };

    const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

    const safeEqual = (a, b) => {
      a = String(a || "");
      b = String(b || "");
      const len = Math.max(a.length, b.length);
      let out = 0;
      for (let i = 0; i < len; i++) out |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
      return out === 0 && a.length === b.length;
    };

    const genToken = () => {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    };

    const toHex = (buf) =>
      [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

    const fromHex = (hex) => {
      const clean = String(hex || "");
      const bytes = new Uint8Array(clean.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
      return bytes;
    };

    const randomSaltHex = () => {
      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
      return [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
    };

    // Cloudflare Workers PBKDF2 iteration cap: 100000
    const PBKDF2_MAX_ITERS = 100000;
    const PBKDF2_DEFAULT_ITERS = 100000;

    async function pbkdf2Hash(password, saltHex, iterations = PBKDF2_DEFAULT_ITERS) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(String(password)),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );

      const iters = Math.min(Number(iterations) || PBKDF2_DEFAULT_ITERS, PBKDF2_MAX_ITERS);

      const bits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: fromHex(saltHex),
          iterations: iters,
        },
        keyMaterial,
        256
      );

      return toHex(bits);
    }

    // Create session
    async function createSession(userId, ttlSeconds = 60 * 60 * 24 * 14) {
      const token = genToken();
      const created = nowSec();
      const expires = created + ttlSeconds;

      await env.DB.prepare(
        `INSERT INTO user_sessions (token, user_id, created_at, expires_at, revoked_at)
         VALUES (?, ?, ?, ?, NULL)`
      )
        .bind(token, userId, created, expires)
        .run();

      return { token, expires_at: expires };
    }

    // Read client session token (returns { user_id, token, expires_at } or null)
    async function requireUser(req) {
      const auth = req.headers.get("authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token) return null;

      const r = await env.DB.prepare(
        `SELECT token, user_id, expires_at, revoked_at
         FROM user_sessions
         WHERE token = ?`
      )
        .bind(token)
        .all();

      const s = r.results?.[0];
      if (!s) return null;
      if (s.revoked_at) return null;
      if (Number(s.expires_at) <= nowSec()) return null;

      return { user_id: s.user_id, token: s.token, expires_at: s.expires_at };
    }

    async function isMember(userId, groupId) {
      const r = await env.DB.prepare(
        `SELECT 1 FROM group_members WHERE user_id = ? AND group_id = ? LIMIT 1`
      )
        .bind(userId, groupId)
        .all();
      return !!r.results?.length;
    }

    async function canAccessTrip(req, tripRow) {
      if (!tripRow) return false;
      if (isAdminRequest(req)) return true;

      if (Number(tripRow.is_public) === 1) return true;

      const sess = await requireUser(req);
      if (!sess) return false;
      return await isMember(sess.user_id, tripRow.group_id);
    }

    async function getUserIdByEmail(email) {
      const e = normalizeEmail(email);
      if (!e) return null;
      const r = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(e).all();
      return r.results?.[0]?.id ?? null;
    }

    async function groupExists(groupId) {
      const r = await env.DB.prepare(`SELECT 1 FROM groups WHERE id = ? LIMIT 1`).bind(groupId).all();
      return !!r.results?.length;
    }

    // ================================================================
    // Routes
    // ================================================================
    try {
      // ================================================================
      // CLIENT AUTH (email + password)
      // ================================================================

      // POST /api/auth/register  { email, password, name? }
      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        const b = await readJson(request);
        const email = normalizeEmail(b.email);
        const password = String(b.password || "");
        const name = b.name ? String(b.name).trim() : null;

        if (!email) return json({ error: "email is required" }, 400);
        if (!password || password.length < 8) {
          return json({ error: "password must be at least 8 characters" }, 400);
        }

        const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).all();
        if (existing.results?.[0]) return json({ error: "email already registered" }, 409);

        const userId = idGen();
        const saltHex = randomSaltHex();
        const iters = PBKDF2_DEFAULT_ITERS;
        const hashHex = await pbkdf2Hash(password, saltHex, iters);

        await env.DB.prepare(
          `INSERT INTO users (id, email, name, created_at, password_salt, password_hash, password_iters)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(userId, email, name, nowSec(), saltHex, hashHex, iters)
          .run();

        const session = await createSession(userId);

        return json({
          ok: true,
          token: session.token,
          expires_at: session.expires_at,
          user: { id: userId, email, name },
        });
      }

      // POST /api/auth/login  { email, password }
      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const b = await readJson(request);
        const email = normalizeEmail(b.email);
        const password = String(b.password || "");

        if (!email || !password) return json({ error: "email and password are required" }, 400);

        const r = await env.DB.prepare(
          `SELECT id, email, name, password_salt, password_hash, password_iters
           FROM users
           WHERE email = ?`
        )
          .bind(email)
          .all();

        const u = r.results?.[0];
        if (!u || !u.password_salt || !u.password_hash) {
          return json({ error: "invalid credentials" }, 401);
        }

        const hashHex = await pbkdf2Hash(password, u.password_salt, u.password_iters || PBKDF2_DEFAULT_ITERS);
        if (!safeEqual(hashHex, u.password_hash)) return json({ error: "invalid credentials" }, 401);

        const session = await createSession(u.id);

        return json({
          ok: true,
          token: session.token,
          expires_at: session.expires_at,
          user: { id: u.id, email: u.email, name: u.name ?? null },
        });
      }

      // POST /api/auth/logout  (Bearer token)
      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const sess = await requireUser(request);
        if (!sess) return json({ ok: true });

        await env.DB.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE token = ?`)
          .bind(nowSec(), sess.token)
          .run();

        return json({ ok: true });
      }

      // GET /api/me  (Bearer token)
      if (url.pathname === "/api/me" && request.method === "GET") {
        const sess = await requireUser(request);
        if (!sess) return json({ error: "unauthorized" }, 401);

        const r = await env.DB.prepare(`SELECT id, email, name, created_at FROM users WHERE id = ?`)
          .bind(sess.user_id)
          .all();

        const u = r.results?.[0];
        if (!u) return json({ error: "unauthorized" }, 401);

        return json({ ok: true, user: u, expires_at: sess.expires_at });
      }

      // ================================================================
      // GROUPS (admin + client)
      // ================================================================

      // GET /api/groups (admin)  <-- IMPORTANT for admin dashboard
      if (url.pathname === "/api/groups" && request.method === "GET") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const r = await env.DB.prepare(
          `SELECT id, name, capacity, brand_id, leader_user_id
           FROM groups
           ORDER BY name ASC`
        ).all();

        return json(r.results ?? []);
      }

      // POST /api/groups (admin)
      if (url.pathname === "/api/groups" && request.method === "POST") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const b = await readJson(request);
        if (!b.name) return json({ error: "name required" }, 400);

        const id = idGen();
        await env.DB.prepare(`INSERT INTO groups (id, name, capacity, brand_id) VALUES (?, ?, ?, ?)`)
          .bind(id, b.name, b.capacity ?? null, b.brand_id ?? null)
          .run();

        return json({ ok: true, id });
      }

      // PUT /api/groups/:id/leader (admin)
      if (url.pathname.startsWith("/api/groups/") && url.pathname.endsWith("/leader") && request.method === "PUT") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const groupId = url.pathname.split("/")[3];
        const b = await readJson(request);

        await env.DB.prepare(`UPDATE groups SET leader_user_id = ? WHERE id = ?`)
          .bind(b.leader_user_id ?? null, groupId)
          .run();

        return json(ok());
      }

      // PUT /api/groups/:id/visibility (admin)
      if (url.pathname.startsWith("/api/groups/") && url.pathname.endsWith("/visibility") && request.method === "PUT") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const groupId = url.pathname.split("/")[3];
        const b = await readJson(request);

        const v = to01(b.is_public);
        if (v === null) return json({ error: "is_public must be true/false (or 1/0)" }, 400);

        await env.DB.prepare(`UPDATE groups SET is_public = ? WHERE id = ?`).bind(v, groupId).run();
        await env.DB.prepare(`UPDATE trips SET is_public = ? WHERE group_id = ?`).bind(v, groupId).run();

        return json(ok());
      }

      // GET /api/groups/:groupId/active-trip
      if (url.pathname.startsWith("/api/groups/") && url.pathname.endsWith("/active-trip") && request.method === "GET") {
        const groupId = url.pathname.split("/")[3];

        // Admin can view; clients must be member
        if (!isAdminRequest(request)) {
          const sess = await requireUser(request);
          if (!sess) return json({ error: "unauthorized" }, 401);
          const member = await isMember(sess.user_id, groupId);
          if (!member) return json({ error: "forbidden" }, 403);
        }

        const now = nowSec();

        const up = await env.DB.prepare(
          `SELECT * FROM trips
           WHERE group_id = ? AND (start_date IS NOT NULL AND start_date >= ?)
           ORDER BY start_date ASC LIMIT 1`
        )
          .bind(groupId, now)
          .all();

        if (up.results?.[0]) return json(up.results[0]);

        const last = await env.DB.prepare(
          `SELECT * FROM trips WHERE group_id = ? ORDER BY (start_date IS NULL) ASC, start_date DESC LIMIT 1`
        )
          .bind(groupId)
          .all();

        return json(last.results?.[0] ?? null);
      }

      // ================================================================
      // GROUP MEMBERSHIP
      // ================================================================

      // Admin: Add user to group (by user_id OR email)
      // POST /api/groups/:groupId/members
      // body: { user_id?: string, email?: string }
      if (url.pathname.startsWith("/api/groups/") && url.pathname.endsWith("/members") && request.method === "POST") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const groupId = url.pathname.split("/")[3];
        if (!groupId) return json({ error: "missing groupId" }, 400);

        if (!(await groupExists(groupId))) return json({ error: "group not found" }, 404);

        const b = await readJson(request);
        let userId = b.user_id ? String(b.user_id) : null;

        if (!userId && b.email) userId = await getUserIdByEmail(b.email);

        if (!userId) return json({ error: "Provide user_id or email" }, 400);

        // Ensure user exists
        const u = await env.DB.prepare(`SELECT 1 FROM users WHERE id = ? LIMIT 1`).bind(userId).all();
        if (!u.results?.length) return json({ error: "user not found" }, 404);

        await env.DB.prepare(`INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`)
          .bind(groupId, userId)
          .run();

        return json({ ok: true, group_id: groupId, user_id: userId });
      }

      // Admin: Remove user from group
      // DELETE /api/groups/:groupId/members/:userId
      if (request.method === "DELETE" && url.pathname.startsWith("/api/groups/") && url.pathname.includes("/members/")) {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const parts = url.pathname.split("/").filter(Boolean);
        // ["api","groups",groupId,"members",userId]
        if (parts.length === 5 && parts[0] === "api" && parts[1] === "groups" && parts[3] === "members") {
          const groupId = parts[2];
          const userId = parts[4];

          await env.DB.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`)
            .bind(groupId, userId)
            .run();

          return json({ ok: true });
        }
      }

      // Admin OR member: List members of a group
      // GET /api/groups/:groupId/members
      if (url.pathname.startsWith("/api/groups/") && url.pathname.endsWith("/members") && request.method === "GET") {
        const groupId = url.pathname.split("/")[3];
        if (!groupId) return json({ error: "missing groupId" }, 400);

        if (!isAdminRequest(request)) {
          const sess = await requireUser(request);
          if (!sess) return json({ error: "unauthorized" }, 401);
          const member = await isMember(sess.user_id, groupId);
          if (!member) return json({ error: "forbidden" }, 403);
        }

        const r = await env.DB.prepare(
          `SELECT u.id, u.email, u.name, u.created_at
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id
           WHERE gm.group_id = ?
           ORDER BY u.email ASC`
        )
          .bind(groupId)
          .all();

        return json(r.results ?? []);
      }

      // Client: List groups I belong to
      // GET /api/my/groups  (Bearer user token)
      if (url.pathname === "/api/my/groups" && request.method === "GET") {
        const sess = await requireUser(request);
        if (!sess) return json({ error: "unauthorized" }, 401);

        const r = await env.DB.prepare(
          `SELECT g.id, g.name, g.capacity, g.brand_id, g.leader_user_id
           FROM groups g
           JOIN group_members gm ON gm.group_id = g.id
           WHERE gm.user_id = ?
           ORDER BY g.name ASC`
        )
          .bind(sess.user_id)
          .all();

        return json(r.results ?? []);
      }

      // ================================================================
      // PAYMENTS (admin for writes)
      // ================================================================

      // GET /api/groups/:id/payments
      if (url.pathname.startsWith("/api/groups/") && url.pathname.endsWith("/payments") && request.method === "GET") {
        const groupId = url.pathname.split("/")[3];

        // Admin can view any; clients must be member of group
        if (!isAdminRequest(request)) {
          const sess = await requireUser(request);
          if (!sess) return json({ error: "unauthorized" }, 401);
          const member = await isMember(sess.user_id, groupId);
          if (!member) return json({ error: "forbidden" }, 403);
        }

        const result = await env.DB.prepare(
          `SELECT id, label, vendor_url, due_at
           FROM payment_links
           WHERE group_id = ?
           ORDER BY (due_at IS NULL) ASC, due_at ASC`
        )
          .bind(groupId)
          .all();

        return json(result.results ?? []);
      }

      // POST /api/groups/:id/payments (admin)
      if (url.pathname.startsWith("/api/groups/") && url.pathname.endsWith("/payments") && request.method === "POST") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const groupId = url.pathname.split("/")[3];
        const body = await readJson(request);
        const { label, vendor_url, due_at } = body;

        if (!groupId || !label || !vendor_url) {
          return json({ error: "Missing: groupId path, label, vendor_url." }, 400);
        }

        const id = idGen();
        await env.DB.prepare(
          `INSERT INTO payment_links (id, group_id, label, vendor_url, due_at)
           VALUES (?, ?, ?, ?, ?)`
        )
          .bind(id, groupId, label, vendor_url, due_at ?? null)
          .run();

        return json({ ok: true, id });
      }

      // ================================================================
      // TRIPS (admin CRUD) + client read rules
      // ================================================================

      // GET /api/trips (?groupId=...)
      if (url.pathname === "/api/trips" && request.method === "GET") {
        const groupId = url.searchParams.get("groupId");

        // Admin: everything (optionally filtered by groupId)
        if (isAdminRequest(request)) {
          const stmt = groupId
            ? env.DB.prepare(
                `SELECT id, group_id, title, start_date, end_date, notes,
                        is_public, has_cruise, has_flights, has_hotel, has_all_inclusive
                 FROM trips
                 WHERE group_id = ?
                 ORDER BY (start_date IS NULL) ASC, start_date ASC`
              ).bind(groupId)
            : env.DB.prepare(
                `SELECT id, group_id, title, start_date, end_date, notes,
                        is_public, has_cruise, has_flights, has_hotel, has_all_inclusive
                 FROM trips
                 ORDER BY (start_date IS NULL) ASC, start_date ASC`
              );

          const r = await stmt.all();
          return json(r.results ?? []);
        }

        // Client: must be logged in
        const sess = await requireUser(request);
        if (!sess) return json({ error: "unauthorized" }, 401);

        if (groupId) {
          const member = await isMember(sess.user_id, groupId);
          if (!member) return json({ error: "forbidden" }, 403);

          const r = await env.DB.prepare(
            `SELECT id, group_id, title, start_date, end_date, notes,
                    is_public, has_cruise, has_flights, has_hotel, has_all_inclusive
             FROM trips
             WHERE group_id = ?
             ORDER BY (start_date IS NULL) ASC, start_date ASC`
          )
            .bind(groupId)
            .all();

          return json(r.results ?? []);
        }

        // No groupId: return trips across all groups the user belongs to
        const r = await env.DB.prepare(
          `SELECT t.id, t.group_id, t.title, t.start_date, t.end_date, t.notes,
                  t.is_public, t.has_cruise, t.has_flights, t.has_hotel, t.has_all_inclusive
           FROM trips t
           JOIN group_members gm ON gm.group_id = t.group_id
           WHERE gm.user_id = ?
           ORDER BY (t.start_date IS NULL) ASC, t.start_date ASC`
        )
          .bind(sess.user_id)
          .all();

        return json(r.results ?? []);
      }

      // POST /api/trips (admin)
      if (url.pathname === "/api/trips" && request.method === "POST") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const b = await readJson(request);
        if (!b.group_id || !b.title) return json({ error: "group_id and title are required" }, 400);

        const id = idGen();
        await env.DB.prepare(
          `INSERT INTO trips (id, group_id, title, start_date, end_date, notes,
                              is_public, has_cruise, has_flights, has_hotel, has_all_inclusive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            b.group_id,
            b.title,
            b.start_date ?? null,
            b.end_date ?? null,
            b.notes ?? null,
            b.is_public ? 1 : 0,
            b.has_cruise ? 1 : 0,
            b.has_flights ? 1 : 0,
            b.has_hotel ? 1 : 0,
            b.has_all_inclusive ? 1 : 0
          )
          .run();

        return json({ ok: true, id });
      }

      // GET /api/trips/:id (admin OR allowed client/public)
      if (
        url.pathname.startsWith("/api/trips/") &&
        request.method === "GET" &&
        !url.pathname.endsWith("/full") &&
        !url.pathname.endsWith("/flags") &&
        !url.pathname.endsWith("/visibility")
      ) {
        const parts = url.pathname.split("/").filter(Boolean); // ["api","trips",":id"]
        if (parts.length === 3) {
          const id = parts[2];

          const r = await env.DB.prepare(
            `SELECT id, group_id, title, start_date, end_date, notes,
                    is_public, has_cruise, has_flights, has_hotel, has_all_inclusive
             FROM trips WHERE id = ?`
          )
            .bind(id)
            .all();

          const trip = r.results?.[0];
          if (!trip) return json({ error: "Not found" }, 404);

          const allowed = await canAccessTrip(request, trip);
          if (!allowed) return json({ error: "forbidden" }, 403);

          return json(trip);
        }
      }

      // PUT /api/trips/:id (admin only)
      if (
        url.pathname.startsWith("/api/trips/") &&
        request.method === "PUT" &&
        !url.pathname.endsWith("/flags") &&
        !url.pathname.endsWith("/visibility") &&
        !url.pathname.endsWith("/full")
      ) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length === 3) {
          if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

          const id = parts[2];
          const b = await readJson(request);
          const toBit = (v) => (typeof v === "boolean" ? (v ? 1 : 0) : null);

          await env.DB.prepare(
            `UPDATE trips
             SET group_id          = COALESCE(?, group_id),
                 title             = COALESCE(?, title),
                 start_date        = COALESCE(?, start_date),
                 end_date          = COALESCE(?, end_date),
                 notes             = COALESCE(?, notes),
                 is_public         = COALESCE(?, is_public),
                 has_cruise        = COALESCE(?, has_cruise),
                 has_flights       = COALESCE(?, has_flights),
                 has_hotel         = COALESCE(?, has_hotel),
                 has_all_inclusive = COALESCE(?, has_all_inclusive)
             WHERE id = ?`
          )
            .bind(
              b.group_id ?? null,
              b.title ?? null,
              b.start_date ?? null,
              b.end_date ?? null,
              b.notes ?? null,
              toBit(b.is_public),
              toBit(b.has_cruise),
              toBit(b.has_flights),
              toBit(b.has_hotel),
              toBit(b.has_all_inclusive),
              id
            )
            .run();

          return json(ok());
        }
      }

      // DELETE /api/trips/:id (admin only)
      if (url.pathname.startsWith("/api/trips/") && request.method === "DELETE") {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length === 3) {
          if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);
          const id = parts[2];
          await env.DB.prepare(`DELETE FROM trips WHERE id = ?`).bind(id).run();
          return json(ok());
        }
      }

      // PUT /api/trips/:id/flags (admin)
      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/flags") && request.method === "PUT") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const id = url.pathname.split("/")[3];
        const b = await readJson(request);

        const hc = to01(b.has_cruise);
        const hf = to01(b.has_flights);
        const hh = to01(b.has_hotel);
        const ha = to01(b.has_all_inclusive);

        if (hc === null && hf === null && hh === null && ha === null) {
          return json(
            { error: "Provide at least one of: has_cruise, has_flights, has_hotel, has_all_inclusive" },
            400
          );
        }

        const sets = [];
        const binds = [];
        if (hc !== null) { sets.push("has_cruise = ?"); binds.push(hc); }
        if (hf !== null) { sets.push("has_flights = ?"); binds.push(hf); }
        if (hh !== null) { sets.push("has_hotel = ?"); binds.push(hh); }
        if (ha !== null) { sets.push("has_all_inclusive = ?"); binds.push(ha); }

        binds.push(id);

        await env.DB.prepare(`UPDATE trips SET ${sets.join(", ")} WHERE id = ?`)
          .bind(...binds)
          .run();

        return json(ok());
      }

      // PUT /api/trips/:id/visibility (admin)
      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/visibility") && request.method === "PUT") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const id = url.pathname.split("/")[3];
        const b = await readJson(request);

        if (b.is_public === undefined) return json({ error: "is_public is required (true/false)" }, 400);

        const isPublic = to01(b.is_public);
        if (isPublic === null) return json({ error: "is_public must be true/false (or 1/0)" }, 400);

        await env.DB.prepare(`UPDATE trips SET is_public = ? WHERE id = ?`).bind(isPublic, id).run();
        return json(ok());
      }

      // GET /api/trips/:id/full (admin OR allowed client/public)
      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/full") && request.method === "GET") {
        const id = url.pathname.split("/")[3];

        const t = await env.DB.prepare(`SELECT * FROM trips WHERE id = ?`).bind(id).all();
        const trip = t.results?.[0];
        if (!trip) return json({ error: "Not found" }, 404);

        const allowed = await canAccessTrip(request, trip);
        if (!allowed) return json({ error: "forbidden" }, 403);

        const [cab, fli, hot, ai] = await Promise.all([
          env.DB.prepare(`SELECT * FROM cruise_cabins WHERE trip_id = ?`).bind(id).all(),
          env.DB.prepare(`SELECT * FROM flight_segments WHERE trip_id = ? ORDER BY depart_ts ASC`).bind(id).all(),
          env.DB.prepare(`SELECT * FROM hotel_rooms WHERE trip_id = ? ORDER BY check_in_ts ASC`).bind(id).all(),
          env.DB.prepare(`SELECT * FROM ai_packages WHERE trip_id = ? ORDER BY check_in_ts ASC`).bind(id).all(),
        ]);

        return json({
          ...trip,
          cruise_cabins: cab.results ?? [],
          flight_segments: fli.results ?? [],
          hotel_rooms: hot.results ?? [],
          all_inclusive: ai.results ?? [],
        });
      }

      // ================================================================
      // DETAILS: LIST/ADD (admin for writes) + DELETE BY ID (admin)
      // ================================================================

      // Cruise cabins: list/add
      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/cruise-cabins") && request.method === "GET") {
        const tripId = url.pathname.split("/")[3];

        const t = await env.DB.prepare(`SELECT id, group_id, is_public FROM trips WHERE id = ?`).bind(tripId).all();
        const trip = t.results?.[0];
        if (!trip) return json({ error: "Not found" }, 404);
        if (!(await canAccessTrip(request, trip))) return json({ error: "forbidden" }, 403);

        const r = await env.DB.prepare(`SELECT * FROM cruise_cabins WHERE trip_id = ?`).bind(tripId).all();
        return json(r.results ?? []);
      }

      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/cruise-cabins") && request.method === "POST") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const tripId = url.pathname.split("/")[3];
        const b = await readJson(request);

        const id = idGen();
        await env.DB.prepare(
          `INSERT INTO cruise_cabins (id, trip_id, cabin_no, category, deck, guests, price_cents, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(id, tripId, b.cabin_no ?? null, b.category ?? null, b.deck ?? null, b.guests ?? null, b.price_cents ?? null, b.notes ?? null)
          .run();

        return json({ ok: true, id });
      }

      // Flights: list/add
      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/flights") && request.method === "GET") {
        const tripId = url.pathname.split("/")[3];

        const t = await env.DB.prepare(`SELECT id, group_id, is_public FROM trips WHERE id = ?`).bind(tripId).all();
        const trip = t.results?.[0];
        if (!trip) return json({ error: "Not found" }, 404);
        if (!(await canAccessTrip(request, trip))) return json({ error: "forbidden" }, 403);

        const r = await env.DB.prepare(`SELECT * FROM flight_segments WHERE trip_id = ? ORDER BY depart_ts ASC`)
          .bind(tripId)
          .all();
        return json(r.results ?? []);
      }

      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/flights") && request.method === "POST") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const tripId = url.pathname.split("/")[3];
        const b = await readJson(request);

        const id = idGen();
        await env.DB.prepare(
          `INSERT INTO flight_segments (id, trip_id, carrier, flight_no, depart_airport, arrive_airport, depart_ts, arrive_ts, record_locator)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            tripId,
            b.carrier ?? null,
            b.flight_no ?? null,
            b.depart_airport ?? null,
            b.arrive_airport ?? null,
            b.depart_ts ?? null,
            b.arrive_ts ?? null,
            b.record_locator ?? null
          )
          .run();

        return json({ ok: true, id });
      }

      // Hotel rooms: list/add
      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/hotel-rooms") && request.method === "GET") {
        const tripId = url.pathname.split("/")[3];

        const t = await env.DB.prepare(`SELECT id, group_id, is_public FROM trips WHERE id = ?`).bind(tripId).all();
        const trip = t.results?.[0];
        if (!trip) return json({ error: "Not found" }, 404);
        if (!(await canAccessTrip(request, trip))) return json({ error: "forbidden" }, 403);

        const r = await env.DB.prepare(`SELECT * FROM hotel_rooms WHERE trip_id = ? ORDER BY check_in_ts ASC`)
          .bind(tripId)
          .all();
        return json(r.results ?? []);
      }

      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/hotel-rooms") && request.method === "POST") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const tripId = url.pathname.split("/")[3];
        const b = await readJson(request);

        const id = idGen();
        await env.DB.prepare(
          `INSERT INTO hotel_rooms (id, trip_id, hotel_name, room_type, check_in_ts, check_out_ts, occupants, confirmation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            tripId,
            b.hotel_name ?? null,
            b.room_type ?? null,
            b.check_in_ts ?? null,
            b.check_out_ts ?? null,
            b.occupants ?? null,
            b.confirmation ?? null
          )
          .run();

        return json({ ok: true, id });
      }

      // All-inclusive: list/add
      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/all-inclusive") && request.method === "GET") {
        const tripId = url.pathname.split("/")[3];

        const t = await env.DB.prepare(`SELECT id, group_id, is_public FROM trips WHERE id = ?`).bind(tripId).all();
        const trip = t.results?.[0];
        if (!trip) return json({ error: "Not found" }, 404);
        if (!(await canAccessTrip(request, trip))) return json({ error: "forbidden" }, 403);

        const r = await env.DB.prepare(`SELECT * FROM ai_packages WHERE trip_id = ? ORDER BY check_in_ts ASC`)
          .bind(tripId)
          .all();
        return json(r.results ?? []);
      }

      if (url.pathname.startsWith("/api/trips/") && url.pathname.endsWith("/all-inclusive") && request.method === "POST") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const tripId = url.pathname.split("/")[3];
        const b = await readJson(request);

        const id = idGen();
        await env.DB.prepare(
          `INSERT INTO ai_packages (id, trip_id, resort_name, plan_name, check_in_ts, check_out_ts, occupants, confirmation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            tripId,
            b.resort_name ?? null,
            b.plan_name ?? null,
            b.check_in_ts ?? null,
            b.check_out_ts ?? null,
            b.occupants ?? null,
            b.confirmation ?? null
          )
          .run();

        return json({ ok: true, id });
      }

      // DELETE detail rows by ID (admin)
      if (url.pathname.startsWith("/api/cruise-cabins/") && request.method === "DELETE") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);
        const id = url.pathname.split("/")[3];
        await env.DB.prepare(`DELETE FROM cruise_cabins WHERE id = ?`).bind(id).run();
        return json(ok());
      }

      if (url.pathname.startsWith("/api/flight-segments/") && request.method === "DELETE") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);
        const id = url.pathname.split("/")[3];
        await env.DB.prepare(`DELETE FROM flight_segments WHERE id = ?`).bind(id).run();
        return json(ok());
      }

      if (url.pathname.startsWith("/api/hotel-rooms/") && request.method === "DELETE") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);
        const id = url.pathname.split("/")[3];
        await env.DB.prepare(`DELETE FROM hotel_rooms WHERE id = ?`).bind(id).run();
        return json(ok());
      }

      if (url.pathname.startsWith("/api/ai-packages/") && request.method === "DELETE") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);
        const id = url.pathname.split("/")[3];
        await env.DB.prepare(`DELETE FROM ai_packages WHERE id = ?`).bind(id).run();
        return json(ok());
      }

      // ================================================================
      // CLIENT SUBMISSIONS (no auth)
      // ================================================================
      if (url.pathname.startsWith("/api/groups/") && url.pathname.endsWith("/trip-submissions") && request.method === "POST") {
        const groupId = url.pathname.split("/")[3];
        const b = await readJson(request);
        if (!b.title) return json({ error: "title is required" }, 400);

        const id = idGen();
        await env.DB.prepare(
          `INSERT INTO trip_submissions (id, group_id, title, start_date, end_date, notes)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(id, groupId, String(b.title), b.start_date ?? null, b.end_date ?? null, b.notes ?? null)
          .run();

        return json({ ok: true, id });
      }

      if (url.pathname.startsWith("/api/groups/") && url.pathname.endsWith("/trip-submissions") && request.method === "GET") {
        const groupId = url.pathname.split("/")[3];
        const r = await env.DB.prepare(
          `SELECT id, group_id, title, start_date, end_date, notes, created_at
           FROM trip_submissions
           WHERE group_id = ?
           ORDER BY created_at DESC`
        )
          .bind(groupId)
          .all();

        return json(r.results ?? []);
      }

      // Admin: promote submission -> trip
      if (url.pathname.startsWith("/api/trip-submissions/") && url.pathname.endsWith("/promote") && request.method === "POST") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const id = url.pathname.split("/")[3];
        const s = await env.DB.prepare(
          `SELECT id, group_id, title, start_date, end_date, notes FROM trip_submissions WHERE id = ?`
        )
          .bind(id)
          .all();

        const sub = s.results?.[0];
        if (!sub) return json({ error: "Not found" }, 404);

        const newId = idGen();
        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO trips (id, group_id, title, start_date, end_date, notes)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(newId, sub.group_id, sub.title, sub.start_date ?? null, sub.end_date ?? null, sub.notes ?? null),
          env.DB.prepare(`DELETE FROM trip_submissions WHERE id = ?`).bind(id),
        ]);

        return json({ ok: true, id: newId });
      }

      // Admin: discard submission
      if (url.pathname.startsWith("/api/trip-submissions/") && request.method === "DELETE") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);
        const id = url.pathname.split("/")[3];
        await env.DB.prepare(`DELETE FROM trip_submissions WHERE id = ?`).bind(id).run();
        return json(ok());
      }

      // ================================================================
      // BRANDS SOCIALS (admin for writes)
      // ================================================================
      if (url.pathname.startsWith("/api/brands/") && url.pathname.endsWith("/socials") && request.method === "GET") {
        const brandId = url.pathname.split("/")[3];
        const r = await env.DB.prepare(
          `SELECT facebook_url, instagram_url, twitter_url, tiktok_url
           FROM brands WHERE id = ?`
        )
          .bind(brandId)
          .all();

        return json(
          r.results?.[0] ?? { facebook_url: null, instagram_url: null, twitter_url: null, tiktok_url: null }
        );
      }

      if (url.pathname.startsWith("/api/brands/") && url.pathname.endsWith("/socials") && request.method === "POST") {
        if (!requireAdmin(request)) return json({ error: "unauthorized" }, 401);

        const brandId = url.pathname.split("/")[3];
        const b = await readJson(request);

        await env.DB.prepare(`INSERT OR IGNORE INTO brands (id, name) VALUES (?, ?)`)
          .bind(brandId, "Unnamed Brand")
          .run();

        await env.DB.prepare(
          `UPDATE brands
           SET facebook_url = COALESCE(?, facebook_url),
               instagram_url= COALESCE(?, instagram_url),
               twitter_url  = COALESCE(?, twitter_url),
               tiktok_url   = COALESCE(?, tiktok_url)
           WHERE id = ?`
        )
          .bind(b.facebook_url ?? null, b.instagram_url ?? null, b.twitter_url ?? null, b.tiktok_url ?? null, brandId)
          .run();

        return json(ok());
      }

      // Fallthrough
      return new Response("Not found", { status: 404, headers: CORS });
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  },
};
