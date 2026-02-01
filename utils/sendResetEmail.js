// utils/sendResetEmail.js
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Use a verified sender later. For testing, Resend often allows onboarding@resend.dev
const FROM_EMAIL = process.env.RESEND_FROM || "onboarding@resend.dev";

async function sendResetEmail(toEmail, resetUrl) {
  return resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "Reset your password",
    html: `
      <div style="font-family:system-ui,Arial,sans-serif;line-height:1.5">
        <h2>Reset your password</h2>
        <p>Click the button below to set a new password.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#00b4d8;color:#fff;text-decoration:none;font-weight:700">
            Reset password
          </a>
        </p>
        <p style="color:#64748b">This link expires in 30 minutes.</p>
      </div>
    `,
  });
}

module.exports = { sendResetEmail };
