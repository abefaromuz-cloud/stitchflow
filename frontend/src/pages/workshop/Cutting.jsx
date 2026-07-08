import { useEffect, useState } from 'react';
import api from '../../api/client';

export default function Cutting() {
  const [sessions, setSessions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [form, setForm] = useState({
    order_id: '', product_name: '', color: '', size: '',
    total_quantity: '', bundle_count: '', bundle_size: '',
    cutter_employee_id: '', cut_date: new Date().toISOString().split('T')[0], notes: ''
  });

  function load() {
    api.get('/workshop/cutting').then(r => setSessions(r.data));
    api.get('/orders').then(r => setOrders(r.data));
    api.get('/employees').then(r => setEmployees(r.data));
  }
  useEffect(() => { load(); }, []);

  // Авторасчёт пачек
  const calcBundles = () => {
    if (!form.total_quantity || !form.bundle_count) return null;
    const per = Math.ceil(Number(form.total_quantity) / Number(form.bundle_count));
    return per;
  };

  const previewBundles = () => {
    if (!form.total_quantity || !form.bundle_count || !form.size) return [];
    const count = Number(form.bundle_count);
    const per = Number(form.bundle_size) || Math.ceil(Number(form.total_quantity) / count);
    const result = [];
    let remaining = Number(form.total_quantity);
    for (let i = 1; i <= count; i++) {
      const qty = i === count ? remaining : Math.min(per, remaining);
      if (qty <= 0) break;
      remaining -= qty;
      result.push({ number: `${form.size}/${i}`, qty });
    }
    return result;
  };

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const r = await api.post('/workshop/cutting', form);
      setLastResult(r.data);
      setShowForm(false);
      setForm({ order_id:'', product_name:'', color:'', size:'', total_quantity:'', bundle_count:'', bundle_size:'', cutter_employee_id:'', cut_date:new Date().toISOString().split('T')[0], notes:'' });
      load();
    } catch (err) { alert(err.response?.data?.error || 'Ошибка'); }
  }

  const preview = previewBundles();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-navy">Крой</h2>
        <button onClick={() => setShowForm(true)} className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Новый крой
        </button>
      </div>

      {lastResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 font-semibold text-sm mb-2">✅ Крой создан! Сгенерировано пачек: {lastResult.bundles.length}</p>
          <div className="flex flex-wrap gap-2">
            {lastResult.bundles.map(b => (
              <span key={b.id} className="bg-white border border-green-200 text-green-700 px-3 py-1 rounded-lg text-xs font-medium">
                {b.bundle_number} — {b.quantity} шт
              </span>
            ))}
          </div>
          <button onClick={() => setLastResult(null)} className="text-xs text-green-500 underline mt-2">Закрыть</button>
        </div>
      )}

      {/* Список сессий кроя */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-400 text-left">
            <tr>
              <th className="px-4 py-3">Изделие</th>
              <th className="px-4 py-3">Размер</th>
              <th className="px-4 py-3">Цвет</th>
              <th className="px-4 py-3">Кол-во</th>
              <th className="px-4 py-3">Пачек</th>
              <th className="px-4 py-3">Закройщик</th>
              <th className="px-4 py-3">Заказ</th>
              <th className="px-4 py-3">Дата</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-navy">{s.product_name}</td>
                <td className="px-4 py-3 font-bold text-indigo-600">{s.size}</td>
                <td className="px-4 py-3">{s.color || '—'}</td>
                <td className="px-4 py-3">{s.total_quantity} шт</td>
                <td className="px-4 py-3">{s.bundle_count_actual} пач.</td>
                <td className="px-4 py-3 text-gray-400">{s.cutter_name || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{s.order_number ? `№${s.order_number}` : '—'}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(s.cut_date).toLocaleDateString('ru-RU')}</td>
              </tr>
            ))}
            {!sessions.length && <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-300">Кроя пока нет</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-navy mb-4">Новый крой</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Изделие *</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Платье Анжелика"
                    value={form.product_name} onChange={e=>setForm({...form,product_name:e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Цвет</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Белый"
                    value={form.color} onChange={e=>setForm({...form,color:e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Размер *</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="44, 46, S, M..."
                    value={form.size} onChange={e=>setForm({...form,size:e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Всего штук *</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.total_quantity} onChange={e=>setForm({...form,total_quantity:e.target.value})} required min="1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Количество пачек *</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.bundle_count} onChange={e=>setForm({...form,bundle_count:e.target.value})} required min="1" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Штук в пачке (если все одинаковые)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={`Авто: ${calcBundles()||'—'}`}
                  value={form.bundle_size} onChange={e=>setForm({...form,bundle_size:e.target.value})} />
              </div>

              {/* Предпросмотр пачек */}
              {preview.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-indigo-700 mb-2">Предпросмотр пачек:</p>
                  <div className="flex flex-wrap gap-2">
                    {preview.map(b => (
                      <span key={b.number} className="bg-white border border-indigo-200 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                        {b.number} — {b.qty} шт
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Закройщик</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.cutter_employee_id} onChange={e=>setForm({...form,cutter_employee_id:e.target.value})}>
                    <option value="">Не указан</option>
                    {employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Привязать к заказу</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.order_id} onChange={e=>setForm({...form,order_id:e.target.value})}>
                    <option value="">Не указан</option>
                    {orders.map(o=><option key={o.id} value={o.id}>№{o.order_number} — {o.product_name?.substring(0,30)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Дата кроя</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.cut_date} onChange={e=>setForm({...form,cut_date:e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Примечание</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">Создать крой и пачки</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
