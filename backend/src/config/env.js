const { z } = require("zod");

const envSchema = z.object({
  PORT: z.string().optional(),

  MONGO_URI: z
    .string({
      required_error: "Missing MONGO_URI",
    })
    .min(1, "Missing MONGO_URI")
    .refine(
      (value) =>
        value.startsWith("mongodb://") ||
        value.startsWith("mongodb+srv://"),
      {
        message: "Invalid MONGO_URI",
      }
    ),

  JWT_SECRET: z
    .string({
      required_error: "Missing JWT_SECRET",
    })
    .min(32, "JWT_SECRET must be at least 32 characters"),

  // optional AI providers
  OLLAMA_HOST: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  HF_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // worker
  WORKER_POLL_INTERVAL_MS: z.string().optional(),
  WORKER_BATCH_SIZE: z.string().optional(),
  WORKER_MAX_ATTEMPTS: z.string().optional(),

  WORKER_SERVICE_TOKEN: z.string().optional(),

  // email
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.string().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // telemetry
  TELEMETRY_ENABLED: z.string().optional(),
  TELEMETRY_ENDPOINT: z.string().optional(),
  DISABLE_ALL_ANALYTICS: z.string().optional(),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("\n❌ Environment Validation Failed:\n");

    result.error.issues.forEach((issue) => {
      console.error(`- ${issue.message}`);
    });

    console.error("\n🛑 Server startup aborted.\n");

    process.exit(1);
  }

  console.log("✅ Environment variables validated successfully.\n");
}

module.exports = validateEnv;