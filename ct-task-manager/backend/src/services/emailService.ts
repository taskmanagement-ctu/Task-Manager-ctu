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
  const registerUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/register` : 'https://taskdesk.ctuniversity.in/register';

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

/**
 * Send Role Promotion Email (Staff -> Department Admin)
 */
export const sendRolePromotionEmail = async (
  toEmail: string,
  recipientName: string,
  universityId: string,
  departmentName?: string | null,
  promotedByName?: string
) => {
  if (!toEmail) {
    console.warn('sendRolePromotionEmail: No recipient email provided.');
    return;
  }

  const subject = `Congratulations! You Have Been Promoted to Department Admin 🎉`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const loginUrl = `${appUrl}/login`;
  const deptDisplay = departmentName || 'Assigned Department';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Role Promotion - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .privileges-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 20px 0; }
        .privileges-title { font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .privileges-list { margin: 0; padding-left: 20px; font-size: 13px; color: #15803d; line-height: 1.6; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #7c3aed; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Institutional Leadership &amp; Administration</p>
        </div>
        <div class="body">
          <div class="badge">★ ROLE PROMOTION</div>
          <div class="greeting">Congratulations ${recipientName || 'Colleague'}!</div>
          <div class="desc">
            We are pleased to inform you that you have been officially promoted to the role of <strong>Department Admin</strong> for <strong>${deptDisplay}</strong> on CT University TaskDesk.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Department:</span>
              <span class="info-value">${deptDisplay}</span>
            </div>
            <div class="info-row">
              <span class="info-label">New Role:</span>
              <span class="info-value" style="color: #6d28d9;">Department Admin</span>
            </div>
            ${
              promotedByName
                ? `<div class="info-row" style="margin-bottom: 0;">
                     <span class="info-label">Promoted By:</span>
                     <span class="info-value">${promotedByName}</span>
                   </div>`
                : ''
            }
          </div>
          <div class="privileges-card">
            <div class="privileges-title">🎯 Your Administrative Privileges:</div>
            <ul class="privileges-list">
              <li>Manage and assign tasks to department staff members</li>
              <li>Evaluate, verify, and approve staff task submissions</li>
              <li>Curate and coordinate your departmental team roster</li>
              <li>Monitor real-time departmental productivity and performance</li>
            </ul>
          </div>
          <div class="desc">
            Your access permissions have been updated immediately. Sign in to your TaskDesk account to access your new Department Admin dashboard.
          </div>
          <div class="cta-container">
            <a href="${loginUrl}" class="cta-btn">Access Admin Dashboard &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send role promotion email to ${toEmail}:`, error);
  }
};

/**
 * Send Role Demotion Email (Department Admin -> Staff)
 */
export const sendRoleDemotionEmail = async (
  toEmail: string,
  recipientName: string,
  universityId: string,
  departmentName?: string | null
) => {
  if (!toEmail) {
    console.warn('sendRoleDemotionEmail: No recipient email provided.');
    return;
  }

  const subject = `Update Regarding Your Institutional Role on CT University TaskDesk`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const loginUrl = `${appUrl}/login`;
  const deptDisplay = departmentName || 'Assigned Department';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Role Update - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .notice-card { background: #f8fafc; border-left: 4px solid #64748b; border-radius: 4px; padding: 14px 16px; margin: 20px 0; font-size: 13px; color: #475569; line-height: 1.5; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Institutional Role Update</p>
        </div>
        <div class="body">
          <div class="badge">📋 ROLE UPDATE</div>
          <div class="greeting">Hello ${recipientName || 'Colleague'},</div>
          <div class="desc">
            This is an official notification to inform you that your institutional role on <strong>CT University TaskDesk</strong> has been updated to <strong>Staff</strong>.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Department:</span>
              <span class="info-value">${deptDisplay}</span>
            </div>
            <div class="info-row" style="margin-bottom: 0;">
              <span class="info-label">Current Role:</span>
              <span class="info-value" style="color: #0f172a;">Staff Member</span>
            </div>
          </div>
          <div class="notice-card">
            Department administrative privileges have concluded or transferred to the appointed Department Admin. You maintain full access to your personal TaskDesk account to receive tasks, submit completions, and track your ongoing assignments.
          </div>
          <div class="desc">
            You can continue accessing your account seamlessly with your existing login credentials.
          </div>
          <div class="cta-container">
            <a href="${loginUrl}" class="cta-btn">Log In to TaskDesk &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send role demotion email to ${toEmail}:`, error);
  }
};

/**
 * Send Roster Addition Email (Staff added to Admin's Team Roster)
 */
export const sendRosterAdditionEmail = async (
  toEmail: string,
  recipientName: string,
  universityId: string,
  departmentName?: string | null,
  adminName?: string,
  assignedByName?: string
) => {
  if (!toEmail) {
    console.warn('sendRosterAdditionEmail: No recipient email provided.');
    return;
  }

  const subject = `You Have Been Added to the Department Team Roster 👥`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const tasksUrl = `${appUrl}/tasks`;
  const deptDisplay = departmentName || 'Assigned Department';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Team Roster Assignment - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .tip-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 16px; margin: 20px 0; font-size: 13px; color: #1e40af; line-height: 1.5; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Institutional Team Coordination</p>
        </div>
        <div class="body">
          <div class="badge">👥 TEAM ROSTER ASSIGNMENT</div>
          <div class="greeting">Hello ${recipientName || 'Colleague'},</div>
          <div class="desc">
            You have been assigned to the department team roster on <strong>CT University TaskDesk</strong>.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Department:</span>
              <span class="info-value">${deptDisplay}</span>
            </div>
            ${
              adminName
                ? `<div class="info-row">
                     <span class="info-label">Reporting Admin:</span>
                     <span class="info-value" style="color: #1d4ed8;">${adminName}</span>
                   </div>`
                : ''
            }
            ${
              assignedByName
                ? `<div class="info-row" style="margin-bottom: 0;">
                     <span class="info-label">Assigned By:</span>
                     <span class="info-value">${assignedByName}</span>
                   </div>`
                : ''
            }
          </div>
          <div class="tip-box">
            📌 <strong>What happens next?</strong><br/>
            You will now receive delegated departmental tasks, project deadlines, and performance evaluations coordinated under ${adminName || 'your Department Admin'}.
          </div>
          <div class="desc">
            Log in to view your task dashboard and start collaborating with your department.
          </div>
          <div class="cta-container">
            <a href="${tasksUrl}" class="cta-btn">View Your TaskDesk Dashboard &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send roster addition email to ${toEmail}:`, error);
  }
};

/**
 * Send an email notifying a user that they have been granted Super Administrator privileges
 */
export const sendSuperAdminPromotionEmail = async (
  toEmail: string,
  recipientName: string,
  universityId: string,
  promotedByName?: string
) => {
  if (!toEmail) return;

  const subject = `Institutional Leadership: Super Administrator Access Granted 🛡️`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const loginUrl = `${appUrl}/login`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Super Administrator Access - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .privileges-card { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 16px; margin: 20px 0; }
        .privileges-title { font-size: 13px; font-weight: 700; color: #6b21a8; margin-bottom: 8px; }
        .privileges-list { margin: 0; padding-left: 20px; font-size: 13px; color: #7e22ce; line-height: 1.6; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #0f172a; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>System Administration &amp; Governance</p>
        </div>
        <div class="body">
          <div class="badge">👑 SUPER ADMINISTRATOR</div>
          <div class="greeting">Greetings, ${recipientName || 'Administrator'}!</div>
          <div class="desc">
            You have been officially granted <strong>Super Administrator</strong> authority across CT University TaskDesk.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Role:</span>
              <span class="info-value" style="color: #6b21a8;">Super Administrator</span>
            </div>
            ${
              promotedByName
                ? `<div class="info-row" style="margin-bottom: 0;">
                     <span class="info-label">Granted By:</span>
                     <span class="info-value">${promotedByName}</span>
                   </div>`
                : ''
            }
          </div>
          <div class="privileges-card">
            <div class="privileges-title">🛡️ System Authority:</div>
            <ul class="privileges-list">
              <li>Full access to university-wide task administration and audits</li>
              <li>Manage department admins, personnel, and roster structures</li>
              <li>Supervise NAAC evaluations, reports, and compliance metrics</li>
            </ul>
          </div>
          <div class="cta-container">
            <a href="${loginUrl}" class="cta-btn">Access Super Admin Console &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send Super Admin promotion email to ${toEmail}:`, error);
  }
};

/**
 * Send an email notifying a previous delegated super admin that their mantle was transferred
 */
export const sendSuperAdminTransferEmail = async (
  toEmail: string,
  recipientName: string,
  universityId: string,
  newSuperAdminName: string
) => {
  if (!toEmail) return;

  const subject = `Update: Super Administrator Role Transferred - CT University TaskDesk`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const loginUrl = `${appUrl}/login`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Super Admin Role Transfer - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Role Notification</p>
        </div>
        <div class="body">
          <div class="badge">ROLE UPDATE</div>
          <div class="greeting">Hello, ${recipientName || 'Colleague'}!</div>
          <div class="desc">
            Your Super Administrator privileges have been transferred to <strong>${newSuperAdminName}</strong>. Your account has returned to Staff status.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">New Role:</span>
              <span class="info-value">Staff</span>
            </div>
            <div class="info-row" style="margin-bottom: 0;">
              <span class="info-label">Transferred To:</span>
              <span class="info-value" style="color: #6b21a8;">${newSuperAdminName}</span>
            </div>
          </div>
          <div class="cta-container">
            <a href="${loginUrl}" class="cta-btn">Sign In to TaskDesk &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send Super Admin transfer email to ${toEmail}:`, error);
  }
};

/**
 * Send an email notification when a task or subtask is assigned to a user
 */
export const sendTaskAssignedEmail = async (
  toEmail: string,
  recipientName: string,
  taskTitle: string,
  taskId: string,
  assignedByName: string,
  assignedByRole: string,
  deadline: Date | string,
  description?: string,
  assignedByEmail?: string,
  taskMongoId?: string
) => {
  if (!toEmail) return;

  const formattedDeadline = deadline
    ? new Date(deadline).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Not specified';

  const isVcOffice = (
    assignedByEmail?.toLowerCase() === 'vc@ctuniversity.in' ||
    assignedByName?.toLowerCase().includes('vice chancellor') ||
    assignedByName?.toLowerCase().includes('nitin')
  );

  const senderDisplayName = isVcOffice 
    ? "Vice Chancellor's Office" 
    : (assignedByName || 'CT University TaskDesk');

  const senderEmailAddress = assignedByEmail || (isVcOffice ? 'vc@ctuniversity.in' : (process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'));

  const roleLabel = isVcOffice
    ? "Vice Chancellor's Office"
    : (assignedByRole === 'super_admin'
      ? 'Super Administrator'
      : assignedByRole === 'department_admin'
      ? 'Department Administrator'
      : 'Colleague');

  const subject = `New Task Assigned by ${senderDisplayName}: [Task #${taskId || ''}] ${taskTitle} - CT University TaskDesk`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const targetId = taskMongoId || taskId || '';
  const taskUrl = targetId 
    ? `${appUrl}/tasks?openTask=${encodeURIComponent(targetId)}` 
    : `${appUrl}/tasks`;

  const descSnippet = description
    ? description.length > 250
      ? `${description.substring(0, 250)}...`
      : description
    : 'No description provided.';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>New Task Assignment - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; text-transform: uppercase; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .task-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .task-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .task-desc-box { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 12.5px; color: #475569; line-height: 1.5; }
        .cta-container { text-align: center; margin: 26px 0 10px; }
        .cta-btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Task Assignment Alert</p>
        </div>
        <div class="body">
          <div class="badge">New Task Assigned</div>
          <div class="greeting">Hello, ${recipientName || 'Colleague'}!</div>
          <div class="desc">
            You have been assigned a new task by <strong>${senderDisplayName}</strong> (${roleLabel}). Please review the task details below:
          </div>
          <div class="task-card">
            <div class="task-title">
              <span style="color: #2563eb; margin-right: 6px;">#${taskId || ''}</span> ${taskTitle}
            </div>
            <div class="info-row">
              <span class="info-label">Assigned By:</span>
              <span class="info-value">${senderDisplayName} &lt;${senderEmailAddress}&gt;</span>
            </div>
            <div class="info-row">
              <span class="info-label">Due Date:</span>
              <span class="info-value" style="color: #dc2626;">📅 ${formattedDeadline}</span>
            </div>
            <div class="task-desc-box">
              <strong>Description:</strong><br />
              ${descSnippet}
            </div>
          </div>
          <div class="cta-container">
            <a href="${taskUrl}" class="cta-btn">Open TaskDesk &amp; View Task &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"${senderDisplayName}" <${senderEmailAddress}>`,
      replyTo: `"${senderDisplayName}" <${senderEmailAddress}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send Task Assigned email to ${toEmail}:`, error);
  }
};





/**
 * Send Task Due Soon Reminder Email (e.g. 3 Days Left)
 */
export const sendTaskDueSoonEmail = async (
  toEmail: string,
  recipientName: string,
  taskTitle: string,
  taskId: string,
  deadline: Date | string,
  daysRemaining: number = 3,
  description?: string,
  taskMongoId?: string
) => {
  if (!toEmail) return;

  const formattedDeadline = deadline
    ? new Date(deadline).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Upcoming';

  const senderDisplayName = 'CT University TaskDesk';
  const senderEmailAddress = process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in';

  const subject = `⏰ Reminder: Task Due in ${daysRemaining} Days - [Task #${taskId || ''}] ${taskTitle}`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const targetId = taskMongoId || taskId || '';
  const taskUrl = targetId 
    ? `${appUrl}/tasks?openTask=${encodeURIComponent(targetId)}` 
    : `${appUrl}/tasks`;

  const descSnippet = description
    ? description.length > 250
      ? `${description.substring(0, 250)}...`
      : description
    : 'No description provided.';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Task Deadline Reminder - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; text-transform: uppercase; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .task-card { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .task-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .task-desc-box { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #fcd34d; font-size: 12.5px; color: #475569; line-height: 1.5; }
        .cta-container { text-align: center; margin: 26px 0 10px; }
        .cta-btn { display: inline-block; background-color: #f59e0b; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Deadline Reminder</p>
        </div>
        <div class="body">
          <div class="badge">⏳ ${daysRemaining} Days Left</div>
          <div class="greeting">Hello, ${recipientName || 'Colleague'}!</div>
          <div class="desc">
            This is a friendly reminder that your assigned task is due in <strong>${daysRemaining} days</strong>. Please complete and submit it before the deadline.
          </div>
          <div class="task-card">
            <div class="task-title">
              <span style="color: #d97706; margin-right: 6px;">#${taskId || ''}</span> ${taskTitle}
            </div>
            <div class="info-row">
              <span class="info-label">Deadline:</span>
              <span class="info-value" style="color: #b45309;">📅 ${formattedDeadline}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Time Remaining:</span>
              <span class="info-value" style="color: #b45309;">⏳ Approx. ${daysRemaining} Day(s)</span>
            </div>
            <div class="task-desc-box">
              <strong>Description:</strong><br />
              ${descSnippet}
            </div>
          </div>
          <div class="cta-container">
            <a href="${taskUrl}" class="cta-btn">Open TaskDesk &amp; Complete Task &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"${senderDisplayName}" <${senderEmailAddress}>`,
      replyTo: `"${senderDisplayName}" <${senderEmailAddress}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send Task Due Soon email to ${toEmail}:`, error);
  }
};

/**
 * Send Daily Task Overdue Alert Email
 */
export const sendTaskOverdueEmail = async (
  toEmail: string,
  recipientName: string,
  taskTitle: string,
  taskId: string,
  deadline: Date | string,
  daysOverdue: number = 1,
  description?: string,
  taskMongoId?: string
) => {
  if (!toEmail) return;

  const formattedDeadline = deadline
    ? new Date(deadline).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Passed';

  const senderDisplayName = 'CT University TaskDesk';
  const senderEmailAddress = process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in';

  const subject = `🚨 Overdue Alert: [Task #${taskId || ''}] ${taskTitle} is Overdue by ${daysOverdue} Day${daysOverdue > 1 ? 's' : ''}`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const targetId = taskMongoId || taskId || '';
  const taskUrl = targetId 
    ? `${appUrl}/tasks?openTask=${encodeURIComponent(targetId)}` 
    : `${appUrl}/tasks`;

  const descSnippet = description
    ? description.length > 250
      ? `${description.substring(0, 250)}...`
      : description
    : 'No description provided.';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Task Overdue Alert - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #7f1d1d; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #fca5a5; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; text-transform: uppercase; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .task-card { background: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .task-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .task-desc-box { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #fca5a5; font-size: 12.5px; color: #475569; line-height: 1.5; }
        .cta-container { text-align: center; margin: 26px 0 10px; }
        .cta-btn { display: inline-block; background-color: #dc2626; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Urgent Action Required</p>
        </div>
        <div class="body">
          <div class="badge">🚨 Overdue by ${daysOverdue} Day${daysOverdue > 1 ? 's' : ''}</div>
          <div class="greeting">Hello, ${recipientName || 'Colleague'}!</div>
          <div class="desc">
            Your assigned task is currently <strong>overdue</strong>. Please submit your work or request a deadline extension as soon as possible.
          </div>
          <div class="task-card">
            <div class="task-title">
              <span style="color: #dc2626; margin-right: 6px;">#${taskId || ''}</span> ${taskTitle}
            </div>
            <div class="info-row">
              <span class="info-label">Original Deadline:</span>
              <span class="info-value" style="color: #dc2626;">📅 ${formattedDeadline}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Overdue Duration:</span>
              <span class="info-value" style="color: #dc2626;">⚠️ ${daysOverdue} Day${daysOverdue > 1 ? 's' : ''} Late</span>
            </div>
            <div class="task-desc-box">
              <strong>Description:</strong><br />
              ${descSnippet}
            </div>
          </div>
          <div class="cta-container">
            <a href="${taskUrl}" class="cta-btn">Open TaskDesk &amp; Update Task &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"${senderDisplayName}" <${senderEmailAddress}>`,
      replyTo: `"${senderDisplayName}" <${senderEmailAddress}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send Task Overdue email to ${toEmail}:`, error);
  }
};

/**
 * Send Cross-Department Task Assignment Permission Granted Email
 */
export const sendCrossDeptTaskPermissionGrantedEmail = async (
  toEmail: string,
  recipientName: string,
  universityId: string,
  departmentName?: string | null,
  grantedByName?: string
) => {
  if (!toEmail) {
    console.warn('sendCrossDeptTaskPermissionGrantedEmail: No recipient email provided.');
    return;
  }

  const subject = `Cross-Department Task Assignment Privileges Granted 🌐 - CT University TaskDesk`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const tasksUrl = `${appUrl}/tasks`;
  const deptDisplay = departmentName || 'Assigned Department';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Cross-Department Privileges Granted - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .privileges-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 20px 0; }
        .privileges-title { font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 8px; }
        .privileges-list { margin: 0; padding-left: 20px; font-size: 13px; color: #15803d; line-height: 1.6; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Institutional Task &amp; Administration</p>
        </div>
        <div class="body">
          <div class="badge">🌐 CROSS-DEPARTMENT ACCESS GRANTED</div>
          <div class="greeting">Hello ${recipientName || 'Colleague'}!</div>
          <div class="desc">
            We are pleased to inform you that you have been granted <strong>Cross-Department Task Assignment privileges</strong> on CT University TaskDesk by <strong>${grantedByName || 'Super Admin'}</strong>.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Base Department:</span>
              <span class="info-value">${deptDisplay}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Delegation Scope:</span>
              <span class="info-value" style="color: #0284c7;">University-Wide (All Departments)</span>
            </div>
            ${
              grantedByName
                ? `<div class="info-row" style="margin-bottom: 0;">
                     <span class="info-label">Authorized By:</span>
                     <span class="info-value">${grantedByName}</span>
                   </div>`
                : ''
            }
          </div>
          <div class="privileges-card">
            <div class="privileges-title">✨ What You Can Do Now:</div>
            <ul class="privileges-list">
              <li>Create and assign tasks across <strong>all university departments</strong></li>
              <li>Assign tasks directly to faculty and staff members institutional-wide</li>
              <li>Select any department recipient in the TaskDesk task creation form</li>
              <li>Coordinate inter-departmental initiatives and special projects</li>
            </ul>
          </div>
          <div class="desc">
            Your privileges are active immediately. You can now access TaskDesk and begin assigning cross-department tasks.
          </div>
          <div class="cta-container">
            <a href="${tasksUrl}" class="cta-btn">Open TaskDesk &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send cross-department task permission granted email to ${toEmail}:`, error);
  }
};

/**
 * Send Cross-Department Task Assignment Permission Revoked Email
 */
export const sendCrossDeptTaskPermissionRevokedEmail = async (
  toEmail: string,
  recipientName: string,
  universityId: string,
  departmentName?: string | null,
  revokedByName?: string
) => {
  if (!toEmail) {
    console.warn('sendCrossDeptTaskPermissionRevokedEmail: No recipient email provided.');
    return;
  }

  const subject = `Update: Cross-Department Task Assignment Privileges Revoked - CT University TaskDesk`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const tasksUrl = `${appUrl}/tasks`;
  const deptDisplay = departmentName || 'Assigned Department';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Cross-Department Privileges Revoked - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .notice-card { background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 14px 16px; margin: 20px 0; font-size: 13px; color: #78350f; line-height: 1.5; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Institutional Task &amp; Administration</p>
        </div>
        <div class="body">
          <div class="badge">⚠️ PERMISSION UPDATE</div>
          <div class="greeting">Hello ${recipientName || 'Colleague'},</div>
          <div class="desc">
            This is an official notification to inform you that your <strong>Cross-Department Task Assignment privileges</strong> on CT University TaskDesk have been revoked by <strong>${revokedByName || 'Super Admin'}</strong>.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Department:</span>
              <span class="info-value">${deptDisplay}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Task Assignment Scope:</span>
              <span class="info-value" style="color: #b45309;">Restricted to ${deptDisplay} Department</span>
            </div>
            ${
              revokedByName
                ? `<div class="info-row" style="margin-bottom: 0;">
                     <span class="info-label">Updated By:</span>
                     <span class="info-value">${revokedByName}</span>
                   </div>`
                : ''
            }
          </div>
          <div class="notice-card">
            <strong>Scope Notice:</strong> Your task creation and assignment scope is now restricted to faculty and staff within your assigned department (<strong>${deptDisplay}</strong>). Previously created cross-department tasks and current workflows remain unaffected.
          </div>
          <div class="desc">
            You continue to have full access to manage tasks and staff within your department on TaskDesk.
          </div>
          <div class="cta-container">
            <a href="${tasksUrl}" class="cta-btn">Access TaskDesk Dashboard &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send cross-department task permission revoked email to ${toEmail}:`, error);
  }
};

/**
 * Send Department Staff Directory Permission Granted Email
 */
export const sendDepartmentPermissionGrantedEmail = async ({
  toEmail,
  recipientName,
  universityId,
  departmentName,
  canAdd,
  canUpload,
  updatedByName,
}: {
  toEmail: string;
  recipientName: string;
  universityId: string;
  departmentName: string;
  canAdd: boolean;
  canUpload: boolean;
  updatedByName?: string;
}) => {
  if (!toEmail) {
    console.warn('sendDepartmentPermissionGrantedEmail: No recipient email provided.');
    return;
  }

  const subject = `Staff Directory Access & Permissions Granted 📁 - CT University TaskDesk`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const directoryUrl = `${appUrl}/verified-users`;
  const deptDisplay = departmentName || 'Assigned Department';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Staff Directory Access Granted - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .privileges-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 20px 0; }
        .privileges-title { font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 8px; }
        .privileges-list { margin: 0; padding-left: 20px; font-size: 13px; color: #15803d; line-height: 1.6; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Institutional Task &amp; Administration</p>
        </div>
        <div class="body">
          <div class="badge">📁 STAFF DIRECTORY ACCESS GRANTED</div>
          <div class="greeting">Hello ${recipientName || 'Colleague'}!</div>
          <div class="desc">
            We are pleased to inform you that your department (<strong>${deptDisplay}</strong>) has been granted <strong>Staff Directory Access &amp; Management Privileges</strong> on CT University TaskDesk by <strong>${updatedByName || 'Super Admin'}</strong>.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Department:</span>
              <span class="info-value">${deptDisplay}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Directory Access:</span>
              <span class="info-value" style="color: #15803d;">Staff Directory Active</span>
            </div>
            <div class="info-row">
              <span class="info-label">Direct Info Addition:</span>
              <span class="info-value" style="color: ${canAdd ? '#15803d' : '#94a3b8'};">${canAdd ? '✅ Allowed' : '❌ Restricted'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Bulk Excel / CSV Upload:</span>
              <span class="info-value" style="color: ${canUpload ? '#15803d' : '#94a3b8'};">${canUpload ? '✅ Allowed' : '❌ Restricted'}</span>
            </div>
            ${
              updatedByName
                ? `<div class="info-row" style="margin-bottom: 0;">
                     <span class="info-label">Authorized By:</span>
                     <span class="info-value">${updatedByName}</span>
                   </div>`
                : ''
            }
          </div>
          <div class="privileges-card">
            <div class="privileges-title">✨ What You Can Do Now:</div>
            <ul class="privileges-list">
              <li>View and search verified faculty and staff records for <strong>${deptDisplay}</strong></li>
              <li>${canAdd ? 'Add new staff member records directly through the directory dashboard' : 'Direct manual addition is restricted by administrator policy'}</li>
              <li>${canUpload ? 'Bulk import and update department staff rosters via Excel / CSV spreadsheets' : 'Bulk spreadsheet uploading is restricted by administrator policy'}</li>
              <li>Ensure verified staff profiles match for task delegation and tracking</li>
            </ul>
          </div>
          <div class="desc">
            Your privileges are active immediately. You can now access the Staff Directory in your TaskDesk side navigation.
          </div>
          <div class="cta-container">
            <a href="${directoryUrl}" class="cta-btn">Access Staff Directory &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send department permission granted email to ${toEmail}:`, error);
  }
};

/**
 * Send Department Staff Directory Permission Revoked Email
 */
export const sendDepartmentPermissionRevokedEmail = async ({
  toEmail,
  recipientName,
  universityId,
  departmentName,
  updatedByName,
}: {
  toEmail: string;
  recipientName: string;
  universityId: string;
  departmentName: string;
  updatedByName?: string;
}) => {
  if (!toEmail) {
    console.warn('sendDepartmentPermissionRevokedEmail: No recipient email provided.');
    return;
  }

  const subject = `Update: Staff Directory Access Revoked - CT University TaskDesk`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const dashboardUrl = `${appUrl}/dashboard`;
  const deptDisplay = departmentName || 'Assigned Department';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Staff Directory Access Revoked - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .notice-card { background: #fff1f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 14px 16px; margin: 20px 0; font-size: 13px; color: #881337; line-height: 1.5; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Institutional Task &amp; Administration</p>
        </div>
        <div class="body">
          <div class="badge">⚠️ PERMISSION REVOKED</div>
          <div class="greeting">Hello ${recipientName || 'Colleague'},</div>
          <div class="desc">
            This is an official notification to inform you that <strong>Staff Directory Access</strong> for your department (<strong>${deptDisplay}</strong>) has been revoked on CT University TaskDesk by <strong>${updatedByName || 'Super Admin'}</strong>.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Department:</span>
              <span class="info-value">${deptDisplay}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Directory Access:</span>
              <span class="info-value" style="color: #dc2626;">Revoked / Disabled</span>
            </div>
            ${
              updatedByName
                ? `<div class="info-row" style="margin-bottom: 0;">
                     <span class="info-label">Updated By:</span>
                     <span class="info-value">${updatedByName}</span>
                   </div>`
                : ''
            }
          </div>
          <div class="notice-card">
            <strong>Access Notice:</strong> You will no longer be able to access, view, or manage verified staff rosters for this department in the directory. Your existing departmental task management, assignment, and review permissions remain fully unaffected.
          </div>
          <div class="desc">
            You continue to have full access to manage and review tasks within your department on TaskDesk.
          </div>
          <div class="cta-container">
            <a href="${dashboardUrl}" class="cta-btn">Access TaskDesk Dashboard &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send department permission revoked email to ${toEmail}:`, error);
  }
};

/**
 * Send Department Staff Directory Privileges Updated Email
 */
export const sendDepartmentPermissionUpdatedEmail = async ({
  toEmail,
  recipientName,
  universityId,
  departmentName,
  canAdd,
  canUpload,
  updatedByName,
}: {
  toEmail: string;
  recipientName: string;
  universityId: string;
  departmentName: string;
  canAdd: boolean;
  canUpload: boolean;
  updatedByName?: string;
}) => {
  if (!toEmail) {
    console.warn('sendDepartmentPermissionUpdatedEmail: No recipient email provided.');
    return;
  }

  const subject = `Update: Staff Directory Privileges Modified - CT University TaskDesk`;
  const appUrl = process.env.FRONTEND_URL || 'https://taskdesk.ctuniversity.in';
  const directoryUrl = `${appUrl}/verified-users`;
  const deptDisplay = departmentName || 'Assigned Department';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Staff Directory Privileges Modified - CT University TaskDesk</title>
      <style>
        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
        .header p { margin: 6px 0 0; font-size: 11px; font-weight: 600; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.08em; }
        .body { padding: 32px 28px; }
        .badge { display: inline-block; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.04em; margin-bottom: 16px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; text-align: right; }
        .cta-container { text-align: center; margin: 28px 0 12px; }
        .cta-btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
        .footer { background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>CT University TaskDesk</h1>
          <p>Institutional Task &amp; Administration</p>
        </div>
        <div class="body">
          <div class="badge">ℹ️ PRIVILEGES MODIFIED</div>
          <div class="greeting">Hello ${recipientName || 'Colleague'}!</div>
          <div class="desc">
            This is an official notification to inform you that your department's (<strong>${deptDisplay}</strong>) <strong>Staff Directory Privileges</strong> on CT University TaskDesk have been updated by <strong>${updatedByName || 'Super Admin'}</strong>.
          </div>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">University ID:</span>
              <span class="info-value">${universityId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Department:</span>
              <span class="info-value">${deptDisplay}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Directory Access:</span>
              <span class="info-value" style="color: #15803d;">Staff Directory Active</span>
            </div>
            <div class="info-row">
              <span class="info-label">Direct Info Addition:</span>
              <span class="info-value" style="color: ${canAdd ? '#15803d' : '#94a3b8'};">${canAdd ? '✅ Allowed' : '❌ Restricted'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Bulk Excel / CSV Upload:</span>
              <span class="info-value" style="color: ${canUpload ? '#15803d' : '#94a3b8'};">${canUpload ? '✅ Allowed' : '❌ Restricted'}</span>
            </div>
            ${
              updatedByName
                ? `<div class="info-row" style="margin-bottom: 0;">
                     <span class="info-label">Updated By:</span>
                     <span class="info-value">${updatedByName}</span>
                   </div>`
                : ''
            }
          </div>
          <div class="desc">
            These changes take effect immediately in your TaskDesk Staff Directory dashboard.
          </div>
          <div class="cta-container">
            <a href="${directoryUrl}" class="cta-btn">Access Staff Directory &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CT University • TaskDesk Institutional Access
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    return await transporter.sendMail({
      from: `"CT University TaskDesk" <${process.env.EMAIL_USER || 'taskmanagement@ctuniversity.in'}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send department permission updated email to ${toEmail}:`, error);
  }
};
