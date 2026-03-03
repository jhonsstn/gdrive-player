import { z } from "zod";

const envSchema = z.object({
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_GOOGLE_ID: z.string().min(1, "AUTH_GOOGLE_ID is required"),
  AUTH_GOOGLE_SECRET: z.string().min(1, "AUTH_GOOGLE_SECRET is required"),
  ADMIN_EMAILS: z.string().min(1, "ADMIN_EMAILS is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

export type AppEnv = z.infer<typeof envSchema>;

let parsedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (parsedEnv) {
    return parsedEnv;
  }

  parsedEnv = envSchema.parse(process.env);
  return parsedEnv;
}
