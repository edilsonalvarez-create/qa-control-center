import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("8h"),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  DATABASE_URL: z.string(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().default("1hCe3QBPraJEvt6H60KcCOiNIFzG6zdL-"),
  DRIVE_SYNC_CRON: z.string().default("0 6 * * *"),
  DRIVE_SYNC_TZ: z.string().default("America/Bogota"),
  DRIVE_SYNC_ENABLED: z.enum(["true", "false", "1", "0"]).optional().default("true"),
  DRIVE_SYNC_MAX_FILES: z.coerce.number().default(400),
  CRON_SECRET: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}
