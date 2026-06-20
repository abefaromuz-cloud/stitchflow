const pool = require('../db/pool');

const TELEGRAM_API = 'https://api.telegram.org';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Отправляет сообщение в Telegram через Bot API.
 * Если BOT_TOKEN не настроен, тихо логирует и пропускает отправку (для разработки без бота).
 */
async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) {
    console.log(`[Telegram disabled] -> chat ${chatId}: ${text}`);
    return { ok: false, skipped: true };
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    return await response.json();
  } catch (err) {
    console.error('Telegram send error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Отправляет уведомление всем подписчикам, у которых включен соответствующий флаг.
 * eventType: new_order | employee_absent | order_completed | payment_received
 */
async function notifySubscribers(eventType, text, payload = {}) {
  const flagColumn = {
    new_order: 'notify_new_order',
    employee_absent: 'notify_employee_absent',
    order_completed: 'notify_order_completed',
    payment_received: 'notify_payment_received'
  }[eventType];

  if (!flagColumn) {
    console.error(`Unknown notification event type: ${eventType}`);
    return;
  }

  let sentCount = 0;
  let status = 'sent';
  let errorMessage = null;

  try {
    const subscribers = await pool.query(
      `SELECT chat_id FROM telegram_subscribers WHERE is_active = true AND ${flagColumn} = true`
    );

    if (!BOT_TOKEN) {
      status = 'skipped';
    }

    for (const sub of subscribers.rows) {
      const result = await sendTelegramMessage(sub.chat_id, text);
      if (result.ok) sentCount++;
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err.message;
    console.error('notifySubscribers error:', err.message);
  }

  try {
    await pool.query(
      `INSERT INTO notification_log (event_type, payload, sent_to_count, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventType, JSON.stringify(payload), sentCount, status, errorMessage]
    );
  } catch (err) {
    console.error('Failed to write notification log:', err.message);
  }

  return { sentCount, status };
}

module.exports = { sendTelegramMessage, notifySubscribers };
