const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(process.cwd(), "data", "sks.db"), {
  readonly: true,
});

const sites = db.prepare(`
  SELECT
    s.id,
    s.displayName,
    s.apiBaseUrl,
    s.statusVisibility,
    COUNT(DISTINCT c.id) AS credentials,
    COUNT(DISTINCT m.id) AS models,
    COUNT(DISTINCT p.id) AS probes
  FROM sks_sites s
  LEFT JOIN sks_credentials c ON c.siteId = s.id
  LEFT JOIN sks_site_models m ON m.siteId = s.id AND m.isCurrentlyListed = 1
  LEFT JOIN sks_probe_results p ON p.siteId = s.id
  GROUP BY s.id, s.displayName, s.apiBaseUrl, s.statusVisibility
  ORDER BY s.id ASC
`).all();

const credentials = db.prepare(`
  SELECT
    siteId,
    apiKeyPreview,
    label,
    isEnabled,
    successCount,
    failureCount,
    stabilityScore,
    lastVerifiedAt,
    lastSuccessAt,
    lastFailureAt
  FROM sks_credentials
  ORDER BY siteId ASC, priorityScore DESC
`).all();

const latestProbes = db.prepare(`
  SELECT
    siteId,
    probeType,
    modelName,
    status,
    httpStatus,
    totalMs,
    errorMessage,
    checkedAt
  FROM sks_probe_results
  ORDER BY datetime(checkedAt) DESC, id DESC
  LIMIT 12
`).all();

console.log(
  JSON.stringify(
    {
      sites,
      credentials,
      latestProbes,
    },
    null,
    2
  )
);
