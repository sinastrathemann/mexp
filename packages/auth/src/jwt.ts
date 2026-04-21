import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

const sessionPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  roles: z.array(z.string()),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

function secretToKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: SessionPayload,
  secret: string,
  maxAgeSeconds: number,
): Promise<string> {
  return new SignJWT({ email: payload.email, roles: payload.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secretToKey(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretToKey(secret));
    const parsed = sessionPayloadSchema.safeParse({
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
