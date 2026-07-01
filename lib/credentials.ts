import { sql } from "@/lib/db";

function normalizeText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .trim();
}

function capitalize(value?: string | null) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) return "";

  return cleanValue.charAt(0).toUpperCase() + cleanValue.slice(1).toLowerCase();
}

export function generateBaseUsername(fullName?: string | null, phone?: string | null) {
  const cleanName = normalizeText(fullName);
  const parts = cleanName.split(/\s+/).filter(Boolean);

  const firstName = parts[0] || "Usu";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "Gym";

  const phoneDigits = String(phone || "").replace(/\D/g, "");

  const firstPart = capitalize(firstName.slice(0, 3)) || "Usu";
  const lastPart = capitalize(lastName.slice(0, 3)) || "Gym";

  const phoneStart = phoneDigits.slice(0, 2) || "00";
  const phoneEnd = phoneDigits.slice(-2) || "00";

  return `${firstPart}${phoneStart}${lastPart}${phoneEnd}`;
}

export async function generateUniqueUsername(
  fullName?: string | null,
  phone?: string | null
) {
  const baseUsername = generateBaseUsername(fullName, phone);

  let username = baseUsername;
  let counter = 1;

  while (true) {
    const existing = await sql`
      select id
      from users
      where lower(username) = ${username.toLowerCase()}
      limit 1
    `;

    if (existing.length === 0) {
      return username;
    }

    username = `${baseUsername}${counter}`;
    counter++;
  }
}

export function generateTemporaryPassword(
  fullName?: string | null,
  phone?: string | null
) {
  const cleanName = normalizeText(fullName);
  const firstName = cleanName.split(/\s+/).filter(Boolean)[0] || "Gym";

  const phoneDigits = String(phone || "").replace(/\D/g, "");
  const phonePart = phoneDigits.slice(-4) || "0000";

  const randomChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789@$#";
  let randomPart = "";

  for (let i = 0; i < 4; i++) {
    randomPart += randomChars.charAt(
      Math.floor(Math.random() * randomChars.length)
    );
  }

  return `${capitalize(firstName.slice(0, 3))}${phonePart}${randomPart}`;
}

export function getTemporaryPasswordExpiration() {
  const expiration = new Date();

  expiration.setHours(expiration.getHours() + 8);

  return expiration;
}