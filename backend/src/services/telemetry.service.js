const os = require("os");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Telemetry = require("../models/telemetry.model.js");
const { version } = require("../../package.json");

const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TELEMETRY_ENDPOINT = process.env.TELEMETRY_ENDPOINT || "https://telematry-website.vercel.app/collector";
const DISABLE_ALL_ANALYTICS = process.env.DISABLE_ALL_ANALYTICS === "true";
const ENV_TELEMETRY_ENABLED = process.env.TELEMETRY_ENABLED === "true";
const ENV_TELEMETRY_DISABLED = process.env.TELEMETRY_ENABLED === "false";

async function ensureTelemetryConfig() {
  return Telemetry.findOneAndUpdate(
    { name: "singleton" },
    {
      $setOnInsert: {
        instanceId: uuidv4(),
        enabled: false,
      },
      $set: {
        lastHeartbeatVersion: null,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

function getFeatureFlags() {
  return {
    memory: Boolean(
      process.env.OPENAI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.HF_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.OLLAMA_HOST
    ),
    rag: Boolean(
      process.env.OPENAI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.HF_API_KEY ||
        process.env.GROQ_API_KEY
    ),
    branching: true,
    scheduling: true,
  };
}

function getTelemetryPayload(config) {
  return {
    instanceId: config.instanceId,
    version: version || "unknown",
    platform: `${os.type()}/${os.arch()}`,
    features: getFeatureFlags(),
    timestamp: new Date().toISOString(),
  };
}

function outboundTelemetryEnabled(config) {
  if (DISABLE_ALL_ANALYTICS) return false;
  if (ENV_TELEMETRY_DISABLED) return false;
  if (!TELEMETRY_ENDPOINT) return false;
  return ENV_TELEMETRY_ENABLED || config.enabled;
}

async function sendHeartbeatIfNeeded(force = false) {
  const config = await ensureTelemetryConfig();
  if (!outboundTelemetryEnabled(config)) return null;

  const now = Date.now();
  const lastHeartbeatAt = config.lastHeartbeatAt
    ? config.lastHeartbeatAt.getTime()
    : 0;

  if (
    !force &&
    config.lastHeartbeatVersion === version &&
    now - lastHeartbeatAt < HEARTBEAT_INTERVAL_MS
  ) {
    return null;
  }

  const payload = getTelemetryPayload(config);

  try {
    await axios.post(TELEMETRY_ENDPOINT, payload, {
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    await Telemetry.findByIdAndUpdate(config._id, {
      lastHeartbeatAt: new Date(),
      lastHeartbeatVersion: version,
    });

    return payload;
  } catch (err) {
    console.error("Telemetry heartbeat failed:", err.message || err);
    return null;
  }
}

async function start() {
  try {
    await ensureTelemetryConfig();
    await sendHeartbeatIfNeeded();

    setInterval(() => {
      sendHeartbeatIfNeeded().catch((err) => {
        console.error("Telemetry periodic heartbeat error:", err?.message || err);
      });
    }, HEARTBEAT_INTERVAL_MS);
  } catch (err) {
    console.error("Telemetry service failed to start:", err);
  }
}

async function updateTelemetryEnabled(enabled) {
  const config = await ensureTelemetryConfig();
  config.enabled = enabled;
  await config.save();
  return config;
}

async function recordTaskMetrics({ stepTypes = [], durationMs = 0 } = {}) {
  const update = {
    $inc: {
      "localMetrics.taskRuns": 1,
      "localMetrics.workflowExecutions": 1,
      "localMetrics.totalStepExecutions": stepTypes.length,
      "localMetrics.totalTaskDurationMs": durationMs,
    },
  };

  stepTypes.forEach((stepType) => {
    const field = `localMetrics.stepTypeCounts.${stepType}`;
    update.$inc[field] = 1;
  });

  return Telemetry.findOneAndUpdate(
    { name: "singleton" },
    update,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function getTelemetryState() {
  const config = await ensureTelemetryConfig();
  return {
    enabled: config.enabled,
    instanceId: config.instanceId,
    lastHeartbeatAt: config.lastHeartbeatAt,
    lastHeartbeatVersion: config.lastHeartbeatVersion,
    endpointConfigured: Boolean(TELEMETRY_ENDPOINT),
    outboundDisabled: DISABLE_ALL_ANALYTICS || ENV_TELEMETRY_DISABLED,
    localMetrics: config.localMetrics || {
      taskRuns: 0,
      workflowExecutions: 0,
      totalStepExecutions: 0,
      totalTaskDurationMs: 0,
      stepTypeCounts: {},
    },
  };
}

module.exports = {
  start,
  getTelemetryState,
  updateTelemetryEnabled,
  recordTaskMetrics,
  sendHeartbeatIfNeeded,
};
