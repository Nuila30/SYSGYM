import { sql } from "@/lib/db";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .trim();
}

function capitalize(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function generateBaseUsername(fullName: string, phone: string) {
  const cleanName = normalizeText(fullName);
  const parts = cleanName.split(/\s+/).filter(Boolean);

  const firstName = parts[0] || "Usu";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "Gym";

  const phoneDigits = phone.replace(/\D/g, "");

  const firstPart = capitalize(firstName.slice(0, 3));
  const lastPart = capitalize(lastName.slice(0, 3));

  const phoneMiddle = phoneDigits.slice(2, 4) || "00";
  const phoneStart = phoneDigits.slice(0, 2) || "00";

  return `${firstPart}${phoneMiddle}${lastPart}${phoneStart}`;
}

export async function generateUniqueUsername(fullName: string, phone: string) {
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

export function generateTemporaryPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$#";
  let password = "";

  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}

export function getTemporaryPasswordExpiration() {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + 8);
  return expiration;
}