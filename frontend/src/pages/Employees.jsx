import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name:'', position:'', phone:'', hire_date:'', base_salary:'', piece_rate:'' });
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.get('/employees').then(r=>setEmployees(r.data)).finally(()=>setLoading(false));
  }
  useEffect(()=>{ load(); },[]);

  async function handleCreate(e) {
    e.preventDefault(); setError('');
    try { await api.post('/employees', form); setShowModal(false); load(); }
    catch (err) { setError(err.response?.data?.error||'Ошибка'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Сотрудники</h1>
        <button onClick={()=>setShowModal(true)} className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium">+ Добавить</button>
      </div>
      {loading ? <p className="text-gray-400">Загрузка...</p> : (
        <div className="grid grid-cols-2 gap-4">
          {employees.map((emp,idx) => (
            <Link key={emp.id} to={`/employees/${emp.id}`} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
              <div className="flex justify-between">
                <div>
                  <p className="font-bold text-navy">{emp.full_name}</p>
                  <p className="text-sm text-gray-400">{emp.position}</p>
                </div>
                {idx===0 && <span className="text-2xl">🏆</span>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-gray-400">Изготовлено</p><p className="font-semibold text-navy">{Number(emp.total_done).toLocaleString()} шт</p></div>
                <div><p className="text-gray-400">Брак</p><p className={`font-semibold ${Number(emp.defect_rate_percent)>2?'text-red-600':'text-green-600'}`}>{emp.defect_rate_percent}%</p></div>
                <div><p className="text-gray-400">Переделки</p><p className={`font-semibold ${Number(emp.rework_rate_percent)>3?'text-amber-600':'text-green-600'}`}>{emp.rework_rate_percent}%</p></div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Новый сотрудник</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ФИО *"
                value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} required />
              <div className="grid grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Должность"
                  value={form.position} onChange={e=>setForm({...form,position:e.target.value})} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Телефон"
                  value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-gray-500">Дата приёма *</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.hire_date} onChange={e=>setForm({...form,hire_date:e.target.value})} required /></div>
                <div><label className="text-xs text-gray-500">Оклад (₽)</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.base_salary} onChange={e=>setForm({...form,base_salary:e.target.value})} /></div>
                <div><label className="text-xs text-gray-500">Сдельная ставка</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    value={form.piece_rate} onChange={e=>setForm({...form,piece_rate:e.target.value})} /></div>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
