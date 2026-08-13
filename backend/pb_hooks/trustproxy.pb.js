/// <reference path="../pb_data/types.d.ts" />

// Trusted proxy headers — makes remoteIP() return the real client IP.
//
// Behind a reverse proxy (nginx/caddy), PocketBase only sees the proxy's IP. This
// module enables the "User IP proxy headers" setting so that remoteIP() — which the
// attendance check-in IP verification (guards.pb.js) relies on — returns the actual
// visitor IP.
//
// Enable with: PB_TRUST_PROXY=true  (see docker-compose.yml).
//
// HOW THE SETTING GETS PERSISTED (PB 0.39):
//   Persisting settings at bootstrap time is done by the migration
//   pb_migrations/1792300000_enable_trusted_proxy.js (it reads PB_TRUST_PROXY and calls
//   app.save(settings), which works during migration). It does NOT happen in this hook:
//   calling e.app.save(settings) from onBootstrap makes the exe panic with a nil pointer
//   dereference (the app is not fully bootstrapped yet) — verified against 0.39.10.
//
//   This hook only validates the configuration and logs a clear warning when the env var
//   is set but the setting was not persisted (e.g. the migration already ran while the
//   env var was false — re-run the migration or flip it in Settings > Meta > User IP
//   proxy headers).
//
// SECURITY: trusting proxy headers lets any client that can reach PocketBase DIRECTLY
// (bypassing the proxy) spoof its IP via X-Forwarded-For, which would defeat the check-in
// IP check. Only enable this when PocketBase is reachable exclusively through a trusted
// proxy that overwrites these headers (e.g. nginx: proxy_set_header X-Forwarded-For
// $proxy_add_x_forwarded_for), and do not publish the PocketBase port to clients.
// useLeftmostIP stays false on purpose: the right-most X-Forwarded-For entry is the one
// appended by your proxy, so a client-supplied header cannot override the real IP.
onBootstrap(function (e) {
  if (process.env.PB_TRUST_PROXY === "true") {
    try {
      var settings = e.app.settings()
      var tp = settings.trustedProxy
      var headers = tp && tp.headers ? tp.headers : []
      if (headers.indexOf("X-Forwarded-For") !== -1) {
        console.log("PB_TRUST_PROXY: trusted proxy headers are enabled (X-Forwarded-For in settings)")
      } else {
        // This hook runs BEFORE migrations, so on the very first boot the migration below
        // hasn't persisted the setting yet — that is expected and the migration logs its
        // own success line. If you see this line on a LATER boot (or no migration line
        // follows), the setting was never persisted: run 'pocketbase migrate up'
        // (1792300000_enable_trusted_proxy) or enable 'User IP proxy headers' in the
        // admin UI (Settings > Meta).
        console.log(
          "PB_TRUST_PROXY: trusted proxy headers not present in settings yet — the " +
          "1792300000_enable_trusted_proxy migration should apply them during this boot."
        )
      }
    } catch (err) {
      console.error("PB_TRUST_PROXY: failed to inspect settings:", err)
    }
  }
  return e.next()
})
