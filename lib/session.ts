import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gym_session")?.value;

  if (!token) {
    return null;
  }

  return await verifySessionToken(token);
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();

  if (session.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return session;
}