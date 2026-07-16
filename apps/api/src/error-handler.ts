import { MexpError, rootLogger } from "@mexp/shared";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

const log = rootLogger.child({ module: "api-error-handler" });

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof MexpError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      // biome-ignore lint/suspicious/noExplicitAny: Hono's ContentfulStatusCode union is over-strict for runtime values
      err.statusCode as any,
    );
  }
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  log.error({ err }, "Unerwarteter Fehler");
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Interner Fehler" } }, 500);
};
