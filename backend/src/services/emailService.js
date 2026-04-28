const nodemailer = require('nodemailer');
const { getDb } = require('../db/database');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const emailTemplates = {
  welcome: (name) => ({
    subject: '🏌️ Welcome to GolfGives!',
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0F1214;color:#fff;padding:40px;border-radius:16px">
      <h1 style="color:#C9A84C;font-size:28px;margin-bottom:8px">Welcome to GolfGives, ${name}!</h1>
      <p style="color:rgba(255,255,255,0.6);line-height:1.6">You're now part of a community that turns every golf score into an act of giving — and a shot at winning.</p>
      <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:12px;padding:20px;margin:24px 0">
        <p style="color:#C9A84C;font-weight:700;margin:0 0 8px">Your next steps:</p>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0">1. Enter your first 5 Stableford scores</p>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0">2. Choose or update your charity</p>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0">3. Watch the monthly draw on the last day of each month</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#C9A84C;color:#0F1214;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Go to Dashboard →</a>
    </div>`
  }),
  drawResults: (name, matches, prize) => ({
    subject: matches >= 3 ? '🏆 You won in this month\'s GolfGives Draw!' : '🎰 April Draw Results — GolfGives',
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0F1214;color:#fff;padding:40px;border-radius:16px">
      <h1 style="color:#C9A84C">${matches >= 3 ? `🏆 Congratulations ${name}!` : `Draw Results, ${name}`}</h1>
      ${matches >= 3
        ? `<p style="color:rgba(255,255,255,0.7)">You matched <strong style="color:#C9A84C">${matches} numbers</strong> and won <strong style="color:#C9A84C">€${prize}</strong>!</p><p style="color:rgba(255,255,255,0.6)">Log in to your dashboard to complete winner verification and claim your prize.</p>`
        : `<p style="color:rgba(255,255,255,0.6)">The draw has been completed. You matched ${matches} numbers this month. Keep playing — the jackpot rolls over!</p>`
      }
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#C9A84C;color:#0F1214;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin-top:16px">View Results →</a>
    </div>`
  }),
  subscriptionConfirm: (name, plan, amount) => ({
    subject: '✅ Subscription Confirmed — GolfGives',
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0F1214;color:#fff;padding:40px;border-radius:16px">
      <h1 style="color:#C9A84C">Subscription Confirmed!</h1>
      <p style="color:rgba(255,255,255,0.7)">Hi ${name}, your <strong>${plan}</strong> plan at <strong>€${amount}</strong> is now active.</p>
      <p style="color:rgba(255,255,255,0.6)">You're entered into this month's draw. Good luck!</p>
    </div>`
  }),
  winnerVerified: (name, prize) => ({
    subject: '💸 Your prize is on its way — GolfGives',
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0F1214;color:#fff;padding:40px;border-radius:16px">
      <h1 style="color:#C9A84C">Payment Approved!</h1>
      <p style="color:rgba(255,255,255,0.7)">Hi ${name}, your prize of <strong style="color:#C9A84C">€${prize}</strong> has been verified and approved. Payment will reach you within 3–5 business days.</p>
    </div>`
  }),
};

async function sendEmail(to, templateKey, ...args) {
  try {
    const template = emailTemplates[templateKey](...args);
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@golfgives.com',
      to,
      subject: template.subject,
      html: template.html,
    });
    // Log notification
    try {
      const db = getDb();
      db.prepare(`INSERT INTO notifications (type, subject, recipient, status) VALUES (?,?,?,'sent')`).run(templateKey, template.subject, to);
    } catch (_) {}
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return false;
  }
}

module.exports = { sendEmail };
