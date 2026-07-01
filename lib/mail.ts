import nodemailer from "nodemailer";

type CredentialsEmailData = {
  to: string;
  fullName: string;
  username: string;
  temporaryPassword: string;
  expiresAt: Date;
};

function clean(value?: string) {
  return String(value || "").trim();
}

function getSmtpConfig() {
  const host = clean(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT || 587);
  const user = clean(process.env.SMTP_USER);

  const pass = clean(process.env.SMTP_PASS).replace(/\s/g, "");
  const from = clean(process.env.SMTP_FROM) || user;

  if (!host || !port || !user || !pass || !from) {
    throw new Error(
      "SMTP no está configurado. Revisa SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y SMTP_FROM en .env.local"
    );
  }

  return {
    host,
    port,
    user,
    pass,
    from,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createTransporter() {
  const config = getSmtpConfig();

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export async function verifySmtpConnection() {
  const transporter = createTransporter();

  await transporter.verify();

  return true;
}

export async function sendCredentialsEmail({
  to,
  fullName,
  username,
  temporaryPassword,
  expiresAt,
}: CredentialsEmailData) {
  const config = getSmtpConfig();
  const transporter = createTransporter();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const loginUrl = `${appUrl}/login`;

  const safeName = escapeHtml(fullName);
  const safeUsername = escapeHtml(username);
  const safePassword = escapeHtml(temporaryPassword);
  const safeLoginUrl = escapeHtml(loginUrl);

  const expirationDate = expiresAt.toLocaleString("es-SV", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  await transporter.sendMail({
    from: config.from,
    to,
    subject: "Acceso creado | Gym SaaS",
    text: `
Hola, ${fullName}

Tu acceso al sistema Gym SaaS ha sido creado correctamente.

Usuario: ${username}
Contraseña temporal: ${temporaryPassword}

Esta contraseña vence el: ${expirationDate}

Ingresa al sistema desde:
${loginUrl}

Al iniciar sesión deberás cambiar tu contraseña.
    `.trim(),
    html: `
      <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #e5e7eb;">
                
                <tr>
                  <td style="background:#0b0b0b;padding:30px 32px;color:#ffffff;">
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#a3a3a3;">
                      Gym SaaS
                    </p>

                    <h1 style="margin:0;font-size:26px;line-height:1.3;font-weight:800;">
                      Tu acceso ha sido creado
                    </h1>

                    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#d4d4d4;">
                      Ya puedes ingresar al sistema de gestión del gimnasio.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px;">
                    <h2 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:#111827;">
                      Hola, ${safeName}
                    </h2>

                    <p style="margin:0;font-size:15px;line-height:1.7;color:#4b5563;">
                      Se ha creado una cuenta de administrador para que puedas acceder al sistema. 
                      Usa las siguientes credenciales temporales para iniciar sesión.
                    </p>

                    <div style="margin:26px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:18px;padding:22px;">
                      <p style="margin:0 0 14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">
                        Credenciales temporales
                      </p>

                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
                            <p style="margin:0;font-size:13px;color:#6b7280;">Usuario</p>
                            <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#111827;">
                              ${safeUsername}
                            </p>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:14px 0 0;">
                            <p style="margin:0;font-size:13px;color:#6b7280;">Contraseña temporal</p>
                            <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#111827;">
                              ${safePassword}
                            </p>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <div style="margin:0 0 26px;background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;padding:16px;">
                      <p style="margin:0;font-size:14px;line-height:1.6;color:#9a3412;">
                        Esta contraseña temporal vence el 
                        <strong>${expirationDate}</strong>.
                        Al iniciar sesión deberás cambiarla por una contraseña propia.
                      </p>
                    </div>

                    <a href="${safeLoginUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-size:14px;font-weight:800;">
                      Iniciar sesión
                    </a>

                    <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;">
                      Este correo fue generado automáticamente. No compartas tus credenciales con otras personas.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
  });

  return true;
}

export async function sendTestEmail(to: string) {
  const config = getSmtpConfig();
  const transporter = createTransporter();

  await transporter.verify();

  await transporter.sendMail({
    from: config.from,
    to,
    subject: "Prueba de correo - Gym SaaS",
    text: "Si recibes este correo, la configuración SMTP funciona correctamente.",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;padding:32px;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px;border:1px solid #e5e7eb;">
          <h2 style="margin:0 0 12px;color:#111827;">Correo de prueba</h2>
          <p style="margin:0;color:#4b5563;line-height:1.6;">
            Si recibes este correo, la configuración SMTP funciona correctamente.
          </p>
        </div>
      </div>
    `,
  });

  return true;
}