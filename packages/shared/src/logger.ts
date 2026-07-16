import { type Logger, pino } from "pino";

const PII_REDACTION_PATHS = [
  "*.email",
  "*.phone",
  "*.firstName",
  "*.lastName",
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "req.headers.authorization",
  "req.headers.cookie",
];

export function createLogger(name: string): Logger {
  return pino({
    name,
    level: process.env["LOG_LEVEL"] ?? "info",
    redact: {
      paths: PII_REDACTION_PATHS,
      censor: "[REDACTED]",
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const rootLogger = createLogger("mexp");
export type { Logger };
