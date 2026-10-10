import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in',
    pass: process.env.EMAIL_PASS || 'lsxycsqdldeznhzq',
  },
});

export const sendOtpEmail = async (
  toEmail: string,
  otp: string,
  purpose: 'registration' | 'forgot_password',
  recipientName?: string
) => {
  const isRegistration = purpose === 'registration';
  const subject = isRegistration 
    ? `Your CT University TaskDesk Verification Code: ${otp}`
    : `Your CT University TaskDesk Password Reset Code: ${otp}`;
  
  const title = isRegistration ? 'Email Verification' : 'Password Reset Request';
  const message = isRegistration
    ? 'Thank you for registering on CT University TaskDesk. Please use the 6-digit verification code below to verify your email address and activate your account.'
    : 'We received a request to reset your password for CT University TaskDesk. Please use the 6-digit verification code below to set a new password.';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .otp-container { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-number { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f172a; margin: 0; }
        .otp-expiry { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 8px; }
        .security-notice { font-size: 12px; line-height: 1.5; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 24px; }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Institutional Task &amp; Workflow Portal</p>
        </div>
        <div class="body">
          <div class="greeting">Hello ${recipientName || 'User'},</div>
          <div class="desc">${message}</div>
          <div class="otp-container">
            <div class="otp-number">${otp}</div>
            <div class="otp-expiry">⏱️ Valid for 10 minutes (Single use only)</div>
          </div>
          <div class="security-notice">
            <strong>Security Reminder:</strong> Never share this code with anyone. CT University IT staff will never ask you for your verification code or password. If you did not initiate this request, you can safely ignore this email.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  return transporter.sendMail({
    from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
    to: toEmail,
    subject,
    html,
  });
};

/**
 * Send Access Request Approval Notification Email
 */
export const sendAccessRequestApprovalEmail = async (
  toEmail: string,
  recipientName: string,
  universityId: string
) => {
  const subject = `Your CT University TaskDesk Access Request Has Been Approved! 🎉`;
  const registerUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/register` : 'https//taskdesk.ctuniversity.in/register';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Access Request Approved</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #34d399; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 20px; margin-bottom: 16px; }
        .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Access Approval Notification</p>
        </div>
        <div class="body">
          <div class="badge">✓ REQUEST APPROVED</div>
          <div class="greeting">Hello ${recipientName || 'Colleague'},</div>
          <div class="desc">
            Great news! Your access request for <strong>CT University TaskDesk</strong> has been approved by the administration. Your University ID has been successfully enrolled into the verified staff directory.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Registered Email:</span>
              <span class="info-value">${toEmail}</span>
            </div>
            <div class="info-row" style="margin-bottom: 0;">
              <span class="info-label">Status:</span>
              <span class="info-value" style="color: #15803d;">Verified &amp; Ready to Register</span>
            </div>
          </div>
          <div class="desc">
            You can now proceed to the registration page, enter your University ID, and click <strong>"Send Code"</strong> to receive your verification OTP and complete account setup.
          </div>
          <div class="cta-container">
            <a href="${registerUrl}" class="cta-btn">Complete Registration &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Portal
        </div>
      </div>
    </body>
    </html>
  `;

  return transporter.sendMail({
    from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
    to: toEmail,
    subject,
    html,
  });
};

/**
 * Send Access Request Rejection Notification Email
 */
export const sendAccessRequestRejectionEmail = async (
  toEmail: string,
  recipientName: string,
  universityId: string,
  reason?: string
) => {
  const subject = `Update Regarding Your CT University TaskDesk Access Request`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Access Request Update</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #f87171; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .note-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px; color: #991b1b; }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Access Request Update</p>
        </div>
        <div class="body">
          <div class="greeting">Hello ${recipientName || 'Colleague'},</div>
          <div class="desc">
            Thank you for your interest in CT University TaskDesk. Your access request for University ID <strong>${universityId}</strong> has been reviewed by the administration, but could not be approved at this time.
          </div>
          ${
            reason
              ? `<div class="note-box"><strong>Reason provided by administrator:</strong><br/>${reason}</div>`
              : ''
          }
          <div class="desc">
            If you believe this is an error or need further clarification, please contact your Department Coordinator or the University IT Helpdesk.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Portal
        </div>
      </div>
    </body>
    </html>
  `;

  return transporter.sendMail({
    from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
    to: toEmail,
    subject,
    html,
  });
};

