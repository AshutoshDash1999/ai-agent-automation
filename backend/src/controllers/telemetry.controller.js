const telemetryService = require("../services/telemetry.service");

async function getTelemetry(req, res) {
  try {
    const telemetry = await telemetryService.getTelemetryState();
    return res.json({ ok: true, telemetry });
  } catch (err) {
    console.error("getTelemetry error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

async function updateTelemetry(req, res) {
  try {
    const enabled = req.body.enabled;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        ok: false,
        error: "telemetry_enabled_boolean_required",
      });
    }

    const telemetry = await telemetryService.updateTelemetryEnabled(enabled);

    if (enabled) {
      await telemetryService.sendHeartbeatIfNeeded(true);
    }

    return res.json({ ok: true, telemetry: {
      enabled: telemetry.enabled,
      instanceId: telemetry.instanceId,
      lastHeartbeatAt: telemetry.lastHeartbeatAt,
      lastHeartbeatVersion: telemetry.lastHeartbeatVersion,
      endpointConfigured: Boolean(process.env.TELEMETRY_ENDPOINT),
      outboundDisabled: process.env.DISABLE_ALL_ANALYTICS === "true" || process.env.TELEMETRY_ENABLED === "false",
      localMetrics: telemetry.localMetrics,
    }});
  } catch (err) {
    console.error("updateTelemetry error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

module.exports = { getTelemetry, updateTelemetry };
