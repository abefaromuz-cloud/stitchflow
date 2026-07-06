import { useState } from 'react';
import api from '../api/client';

export default function Settings() {
  const [form, setForm] = useState({ current_password:'', new_password:'', confirm:'' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault(); setMsg(''); setError('');
    if (form.new_password !== form.confirm) return setError('Пароли не совпадают');
    if (form.new_password.length < 6) return setError('Минимум 6 символов');
    try {
      await api.put('/auth/change-password', { current_password:form.current_password, new_password:form.new_password });
      setMsg('✅ Пароль успешно изменён');
      setForm({ current_password:'', new_password:'', confirm:'' });
    } catch(err) { setError(err.response?.data?.error||'Ошибка'); }
  }

  const user = JSON.parse(localStorage.getItem('sf_user')||'{}');

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-2xl font-bold text-navy">Настройки</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-navy mb-3">Профиль</h2>
        <p className="text-sm text-gray-600"><span className="font-medium">Имя:</span> {user.full_name}</p>
        <p className="text-sm text-gray-600 mt-1"><span className="font-medium">Email:</span> {user.email}</p>
        <p className="text-sm text-gray-600 mt-1"><span className="font-medium">Роль:</span> {user.role}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-navy mb-4">Смена пароля</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Текущий пароль</label>
            <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              value={form.current_password} onChange={e=>setForm({...form,current_password:e.target.value})} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Новый пароль</label>
            <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              value={form.new_password} onChange={e=>setForm({...form,new_password:e.target.value})} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Подтвердите пароль</label>
            <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} required />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {msg && <p className="text-green-600 text-sm">{msg}</p>}
          <button type="submit" className="w-full bg-navy text-white rounded-lg py-2.5 font-medium hover:bg-navy/90 transition">
            Сменить пароль
          </button>
        </form>
      </div>
    </div>
  );
}
