const mongoose = require("mongoose");

const TelemetryMetricsSchema = new mongoose.Schema(
  {
    taskRuns: { type: Number, default: 0 },
    workflowExecutions: { type: Number, default: 0 },
    totalStepExecutions: { type: Number, default: 0 },
    totalTaskDurationMs: { type: Number, default: 0 },
    stepTypeCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { _id: false }
);

const TelemetrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "singleton",
      unique: true,
      index: true,
    },
    instanceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    lastHeartbeatAt: {
      type: Date,
      default: null,
    },
    lastHeartbeatVersion: {
      type: String,
      default: null,
    },
    localMetrics: {
      type: TelemetryMetricsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Telemetry || mongoose.model("Telemetry", TelemetrySchema);
