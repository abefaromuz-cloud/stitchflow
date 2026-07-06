import { useEffect, useState } from 'react';
import api from '../api/client';

export default function TelegramSettings() {
  const [subs, setSubs] = useState([]);
  const [form, setForm] = useState({ chat_id:'', full_name:'', role:'manager' });
  const [testId, setTestId] = useState('');
  const [msg, setMsg] = useState('');

  function load() { api.get('/telegram/subscribers').then(r=>setSubs(r.data)); }
  useEffect(()=>{ load(); },[]);

  async function addSub(e) {
    e.preventDefault();
    try { await api.post('/telegram/subscribers', form); setForm({chat_id:'',full_name:'',role:'manager'}); load(); }
    catch(err) { setMsg(err.response?.data?.error||'Ошибка'); }
  }

  async function sendTest() {
    try { const r = await api.post('/telegram/test', {chat_id:testId}); setMsg(r.data.ok?'✅ Отправлено':'❌ Ошибка: '+JSON.stringify(r.data)); }
    catch(err) { setMsg('Ошибка: '+err.message); }
  }

  async function toggle(sub, field) {
    await api.put(`/telegram/subscribers/${sub.id}`, {[field]:!sub[field]});
    load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy">Telegram-уведомления</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">Как добавить получателя:</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-600">
          <li>Напишите <b>@userinfobot</b> в Telegram — он пришлёт ваш Chat ID</li>
          <li>Вставьте Chat ID ниже и нажмите «Добавить»</li>
          <li>Отправьте тест чтобы проверить доставку</li>
        </ol>
      </div>

      {msg && <div className="bg-gray-50 border rounded-xl p-3 text-sm text-gray-700">{msg}</div>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-navy mb-3">Добавить получателя</h2>
        <form onSubmit={addSub} className="flex gap-3">
          <input className="border rounded-lg px-3 py-2 text-sm w-40" placeholder="Chat ID *"
            value={form.chat_id} onChange={e=>setForm({...form,chat_id:e.target.value})} required />
          <input className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder="Имя"
            value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} />
          <button type="submit" className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium">Добавить</button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-navy mb-3">Тест отправки</h2>
        <div className="flex gap-3">
          <input className="border rounded-lg px-3 py-2 text-sm w-40" placeholder="Chat ID"
            value={testId} onChange={e=>setTestId(e.target.value)} />
          <button onClick={sendTest} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Отправить тест</button>
        </div>
      </div>

      {subs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-left">
              <tr><th className="px-4 py-3">Получатель</th><th className="px-4 py-3">Chat ID</th><th className="px-4 py-3">Новые заказы</th><th className="px-4 py-3">Отсутствие</th><th className="px-4 py-3">Завершение</th><th className="px-4 py-3">Оплата</th><th className="px-4 py-3">Активен</th></tr>
            </thead>
            <tbody>
              {subs.map(s=>(
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 font-medium text-navy">{s.full_name||'—'}</td>
                  <td className="px-4 py-3 text-gray-400">{s.chat_id}</td>
                  {['notify_new_order','notify_employee_absent','notify_order_completed','notify_payment_received','is_active'].map(f=>(
                    <td key={f} className="px-4 py-3">
                      <button onClick={()=>toggle(s,f)} className={`w-10 h-5 rounded-full transition ${s[f]?'bg-green-500':'bg-gray-200'}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
