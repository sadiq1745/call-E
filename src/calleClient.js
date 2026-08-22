import { CalleClient } from "@call-e/calle";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Set it in .env.`);
  }
  return value;
}

export function createCalleClient() {
  return new CalleClient({
    apiKey: requireEnv("CALLE_API_KEY"),
    baseUrl: requireEnv("CALLE_BASE_URL"),
  });
}
