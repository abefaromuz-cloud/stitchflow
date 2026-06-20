import { useEffect, useState } from 'react';
import api from '../api/client';

const EVENT_LABELS = {
  notify_new_order: 'Новый заказ',
  notify_employee_absent: 'Сотрудник отсутствует',
  notify_order_completed: 'Заказ завершен',
  notify_payment_received: 'Поступила оплата'
};

export default function TelegramSettings() {
  const [subscribers, setSubscribers] = useState([]);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ chat_id: '', full_name: '', role: 'manager' });
  const [error, setError] = useState('');
  const [testMessage, setTestMessage] = useState('');

  function load() {
    setLoading(true);
    Promise.all([api.get('/telegram/subscribers'), api.get('/telegram/log')])
      .then(([subsRes, logRes]) => {
        setSubscribers(subsRes.data);
        setLog(logRes.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/telegram/subscribers', form);
      setShowModal(false);
      setForm({ chat_id: '', full_name: '', role: 'manager' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Ошибка');
    }
  }

  async function toggleFlag(sub, flag) {
    try {
      await api.put(`/telegram/subscribers/${sub.id}`, { [flag]: !sub[flag] });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Удалить подписчика?')) return;
    try {
      await api.delete(`/telegram/subscribers/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  }

  async function handleTest(chatId) {
    setTestMessage('');
    try {
      const { data } = await api.post('/telegram/test', { chat_id: chatId });
      setTestMessage(data.ok ? 'Сообщение отправлено успешно' : data.skipped ? 'Бот не настроен (TELEGRAM_BOT_TOKEN отсутствует) — событие записано в лог' : 'Ошибка отправки');
    } catch (err) {
      setTestMessage(err.response?.data?.error || 'Ошибка');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Telegram-уведомления</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy/90"
        >
          + Добавить подписчика
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        Чтобы получать уведомления, узнайте свой <code>chat_id</code> у бота
        <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="underline ml-1">@userinfobot</a>,
        затем добавьте его здесь. Для реальной отправки сообщений укажите <code>TELEGRAM_BOT_TOKEN</code> в .env сервера.
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Имя</th>
                <th className="px-4 py-3">Chat ID</th>
                <th className="px-4 py-3">Роль</th>
                {Object.entries(EVENT_LABELS).map(([key, label]) => (
                  <th key={key} className="px-4 py-3">{label}</th>
                ))}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => (
                <tr key={sub.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{sub.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{sub.chat_id}</td>
                  <td className="px-4 py-3 text-gray-500">{sub.role}</td>
                  {Object.keys(EVENT_LABELS).map((flag) => (
                    <td key={flag} className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={sub[flag]}
                        onChange={() => toggleFlag(sub, flag)}
                        className="w-4 h-4"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => handleTest(sub.chat_id)} className="text-xs text-navy underline">Тест</button>
                    <button onClick={() => handleDelete(sub.id)} className="text-xs text-red-600 underline">Удалить</button>
                  </td>
                </tr>
              ))}
              {subscribers.length === 0 && (
                <tr>
                  <td colSpan={3 + Object.keys(EVENT_LABELS).length + 1} className="px-4 py-6 text-center text-gray-400">
                    Подписчиков пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {testMessage && <p className="text-sm text-gray-600">{testMessage}</p>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-navy mb-3">Журнал уведомлений</h2>
        {log.length === 0 ? (
          <p className="text-gray-400 text-sm">Уведомлений пока не было</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {log.map((l) => (
              <div key={l.id} className="flex justify-between items-center text-sm border-b pb-2">
                <span>{l.event_type}</span>
                <span className="text-xs text-gray-400">
                  {l.status} · {l.sent_to_count} получателей · {new Date(l.created_at).toLocaleString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Новый подписчик</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Chat ID</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.chat_id}
                  onChange={(e) => setForm({ ...form, chat_id: e.target.value })}
                  placeholder="123456789"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Имя</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Роль</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="owner">Владелец</option>
                  <option value="manager">Менеджер</option>
                  <option value="employee">Сотрудник</option>
                </select>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border">
                  Отмена
                </button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
