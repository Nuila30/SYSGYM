import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error("JWT_SECRET no está configurado en .env.local");
}

const encodedSecret = new TextEncoder().encode(secret);

export type SessionPayload = {
  userId: string;
  gymId: string | null;
  fullName: string;
  username: string;
  email: string;
  role: "SUPER_ADMIN" | "GYM_ADMIN" | "EMPLOYEE" | "MEMBER";
  mustChangePassword?: boolean;
};

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedSecret);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}