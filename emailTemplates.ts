// src/emailTemplates.ts
// Reusable HTML email templates for Reserva, styled to match the app's design system.

export function buildVerificationEmail(name: string, code: string): string {
  const digits = code.split("");
  const digitCells = digits
    .map(
      (d) => `
      <td style="padding: 0 3px;" class="digit-cell">
        <div style="width: 100%; max-width: 40px; height: 48px; background: #ebe4d8; border-radius: 10px; text-align: center; line-height: 48px; font-size: 22px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1f1b16;">
          ${d}
        </div>
      </td>`,
    )
    .join("");

  return `
<style>
  @media only screen and (max-width: 480px) {
    .email-container { width: 100% !important; border-radius: 12px !important; }
    .email-padding { padding-left: 20px !important; padding-right: 20px !important; }
    .email-title { font-size: 24px !important; }
    .digit-box { width: 34px !important; height: 42px !important; line-height: 42px !important; font-size: 18px !important; }
    .digit-cell { padding: 0 2px !important; }
    .footer-cell { display: block !important; width: 100% !important; text-align: left !important; padding-top: 8px; }
  }
  @media only screen and (max-width: 360px) {
    .digit-box { width: 28px !important; height: 38px !important; line-height: 38px !important; font-size: 16px !important; }
  }
</style>

<div style="background: #f2ece2; padding: 40px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 480px; width: 100%; margin: 0 auto; background: #f6f1e8; border-radius: 20px; overflow: hidden;">

    <!-- Header -->
    <tr>
      <td class="email-padding" style="padding: 32px 32px 24px 32px;">
        <div style="font-size: 12px; letter-spacing: 2px; font-weight: 700; color: #8a7f6b; text-transform: uppercase; margin-bottom: 12px;">
          RESERVA
        </div>
        <div class="email-title" style="font-family: Georgia, 'Times New Roman', serif; font-size: 30px; line-height: 1.25; color: #1f1b16;">
          Verify your account,<br>${name}.
        </div>
      </td>
    </tr>

    <tr><td style="border-top: 1px solid #e2d9c8;"></td></tr>

    <!-- Body -->
    <tr>
      <td class="email-padding" style="padding: 24px 32px 8px 32px;">
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4a4438;">
          Your one-time verification code is below. Enter it to complete sign-in — it expires in 10 minutes.
        </p>
      </td>
    </tr>

    <!-- Code label -->
    <tr>
      <td class="email-padding" style="padding: 24px 32px 12px 32px;">
        <div style="font-size: 11px; letter-spacing: 1.5px; font-weight: 700; color: #8a7f6b; text-transform: uppercase;">
          VERIFICATION CODE
        </div>
      </td>
    </tr>

    <!-- Digit boxes -->
    <tr>
      <td class="email-padding" style="padding: 0 32px 20px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;"><tr>${digitCells}</tr></table>
      </td>
    </tr>

    <!-- Expiry pill -->
    <tr>
      <td class="email-padding" style="padding: 0 32px 24px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background: #7d8f5a; border-radius: 999px; padding: 10px 20px; text-align: center;">
              <span style="color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 1px;">
                EXPIRES IN 10 MINUTES
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr><td style="border-top: 1px solid #e2d9c8;"></td></tr>

    <!-- Disclaimer -->
    <tr>
      <td class="email-padding" style="padding: 24px 32px 32px 32px;">
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #8a7f6b;">
          If you didn't request this, you can safely ignore this email. Never share this code with anyone — Reserva will never ask for it.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td class="email-padding" style="background: #ebe4d8; padding: 20px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td class="footer-cell" style="font-size: 12px; color: #a39a86;">&copy; 2026 Reserva</td>
            <td class="footer-cell" style="font-size: 12px; color: #a39a86; text-align: right;">
              <a href="#" style="color: #a39a86; text-decoration: none; margin-left: 16px;">Privacy</a>
              <a href="#" style="color: #a39a86; text-decoration: none; margin-left: 16px;">Terms</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>
  <div style="text-align: center; margin-top: 16px; font-size: 12px; color: #a39a86;">
    noreply@reservaapp.app
  </div>
</div>`;
}
