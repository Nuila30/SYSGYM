import nodemailer from "nodemailer";

type CredentialsEmailData = {
  to: string;
  fullName: string;
  username: string;
  temporaryPassword: string;
  expiresAt: Date;
};

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

export async function sendCredentialsEmail({
  to,
  fullName,
  username,
  temporaryPassword,
  expiresAt,
}: CredentialsEmailData) {
  if (!hasSmtpConfig()) {
    console.log("SMTP no configurado. Credenciales generadas:");
    console.log({
      to,
      fullName,
      username,
      temporaryPassword,
      expiresAt,
    });

    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const loginUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000/login";

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Tus credenciales de acceso al sistema",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
        <h2>Hola, ${fullName}</h2>

        <p>Se ha creado tu acceso al sistema del gimnasio.</p>

        <div style="background:#f5f5f5;padding:16px;border-radius:10px;margin:16px 0;">
          <p><strong>Usuario:</strong> ${username}</p>
          <p><strong>Contraseña temporal:</strong> ${temporaryPassword}</p>
          <p><strong>Vence:</strong> ${expiresAt.toLocaleString("es-SV")}</p>
        </div>

        <p>
          Esta contraseña temporal tiene una duración de 8 horas.
          Al iniciar sesión deberás cambiarla por una contraseña propia.
        </p>

        <p>
          Ingresa aquí:
          <a href="${loginUrl}">${loginUrl}</a>
        </p>
      </div>
    `,
  });
}