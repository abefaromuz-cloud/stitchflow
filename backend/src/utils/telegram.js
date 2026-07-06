const pool = require('../db/pool');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) { console.log(`[TG disabled] -> ${chatId}: ${text}`); return { ok: false, skipped: true }; }
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id: chatId, text, parse_mode:'HTML' })
    });
    return r.json();
  } catch (err) { return { ok: false, error: err.message }; }
}

async function notifySubscribers(eventType, text, payload={}) {
  const flagMap = { new_order:'notify_new_order', employee_absent:'notify_employee_absent', order_completed:'notify_order_completed', payment_received:'notify_payment_received' };
  const flag = flagMap[eventType];
  if (!flag) return;
  try {
    const subs = await pool.query(`SELECT chat_id FROM telegram_subscribers WHERE is_active=true AND ${flag}=true`);
    let sent = 0;
    for (const s of subs.rows) { const r = await sendTelegramMessage(s.chat_id, text); if (r.ok) sent++; }
    await pool.query(`INSERT INTO notification_log (event_type,payload,sent_to_count,status) VALUES ($1,$2,$3,'sent')`, [eventType, JSON.stringify(payload), sent]);
  } catch (err) { console.error('notify error:', err.message); }
}

module.exports = { sendTelegramMessage, notifySubscribers };
