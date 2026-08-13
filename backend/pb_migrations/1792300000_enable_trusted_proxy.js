/// <reference path="../pb_data/types.d.ts" />

// PB_TRUST_PROXY=true -> persist the "User IP proxy headers" setting so remoteIP()
// returns the real client IP behind nginx/caddy (attendance check-in IP verification).
//
// This MUST be a migration, not a bootstrap hook: on PB 0.39 calling e.app.save(settings)
// from onBootstrap panics with a nil pointer dereference (app not fully bootstrapped yet),
// while the same call works from a migration — verified against the 0.39.10 exe.
//
// NOTE: migrations run once per pb_data and are recorded in _migrations. If you flip
// PB_TRUST_PROXY=true after this migration already ran (e.g. first boot had it false),
// re-run it with:  pocketbase migrate up  — or enable the setting manually in the admin
// UI (Settings > Meta > User IP proxy headers).
migrate(
  (app) => {
    if (process.env.PB_TRUST_PROXY !== "true") return
    const settings = app.settings()
    const existing = settings.trustedProxy && settings.trustedProxy.headers ? settings.trustedProxy.headers : []

    // X-Forwarded-For first = higher priority (multi-proxy chains append to it)
    const order = ["X-Forwarded-For", "X-Real-IP"]
    const headers = []
    for (const h of order) {
      if (existing.indexOf(h) === -1 && headers.indexOf(h) === -1) headers.push(h)
    }
    for (const h of existing) {
      if (headers.indexOf(h) === -1) headers.push(h)
    }

    settings.trustedProxy = {
      headers,
      useLeftmostIP: false,
    }
    app.save(settings)
    console.log("PB_TRUST_PROXY: persisted trusted proxy headers:", headers.join(", "))
  },
  (app) => {
    const settings = app.settings()
    settings.trustedProxy = { headers: [], useLeftmostIP: false }
    app.save(settings)
    console.log("PB_TRUST_PROXY: cleared trusted proxy headers (down migration)")
  }
)
