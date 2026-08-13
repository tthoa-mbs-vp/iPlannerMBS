/// <reference path="../pb_data/types.d.ts" />

// H4: the list/view scope handlers that used to live here were merged into scope.pb.js.
// Both files previously registered onRecordsListRequest / onRecordViewRequest, and
// registering the same event from multiple *.pb.js files is unreliable in PB 0.26
// (only one file's handlers may run) — so all list/view scoping now lives in the single
// handler in scope.pb.js, dispatched by collection name.
//
// The HR helpers (hrScopeContext / hrUserInScope / hrCollections) remain in helpers.js.
// This file intentionally registers nothing.
