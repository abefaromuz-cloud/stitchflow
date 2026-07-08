import { useEffect, useState } from 'react';
import api from '../../api/client';

export default function FabricShipment() {
  const [rolls, setRolls] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    order_id: '', fabric_name: '', color: '', roll_number: '', meters: '',
    consumption_per_unit: '', shipment_date: new Date().toISOString().split('T')[0], notes: ''
  });

  function load() {
    api.get('/workshop/fabric-shipments').then(r => setRolls(r.data));
    api.get('/orders').then(r => setOrders(r.data));
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post('/workshop/fabric-shipments', form);
      setShowForm(false);
      setForm({ order_id:'', fabric_name:'', color:'', roll_number:'', meters:'', consumption_per_unit:'', shipment_date:new Date().toISOString().split('T')[0], notes:'' });
      load();
    } catch (err) { alert(err.response?.data?.error || 'Ошибка'); }
  }

  async function deleteRoll(id) {
    if (!confirm('Удалить рулон?')) return;
    await api.delete(`/workshop/fabric-shipments/${id}`);
    load();
  }

  // Сводка по цвету
  const byColor = rolls.reduce((acc, r) => {
    const key = `${r.fabric_name||'Ткань'} / ${r.color||'—'}`;
    if (!acc[key]) acc[key] = { rolls: 0, meters: 0, expected_units: 0 };
    acc[key].rolls++;
    acc[key].meters += Number(r.meters);
    acc[key].expected_units += Number(r.expected_units||0);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-navy">Отгрузка ткани (рулоны)</h2>
        <button onClick={() => setShowForm(true)} className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Добавить рулон
        </button>
      </div>

      {/* Сводка по цвету */}
      {Object.keys(byColor).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-navy mb-2">Сводка по ткани</p>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(byColor).map(([key, v]) => (
              <div key={key} className="bg-white rounded-lg p-3 text-xs">
                <p className="font-semibold text-navy">{key}</p>
                <p className="text-gray-500 mt-1">{v.rolls} рул. · {v.meters.toFixed(1)} м</p>
                {v.expected_units > 0 && <p className="text-green-600 font-medium">→ {v.expected_units} изд.</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Таблица рулонов */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-400 text-left">
            <tr>
              <th className="px-4 py-3">Рулон №</th>
              <th className="px-4 py-3">Ткань</th>
              <th className="px-4 py-3">Цвет</th>
              <th className="px-4 py-3">Метраж</th>
              <th className="px-4 py-3">Расход/ед.</th>
              <th className="px-4 py-3">Выход изд.</th>
              <th className="px-4 py-3">Заказ</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rolls.map(r => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-navy">#{r.roll_number}</td>
                <td className="px-4 py-3">{r.fabric_name || '—'}</td>
                <td className="px-4 py-3">
                  {r.color && (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border border-gray-200 inline-block" style={{backgroundColor: r.color.toLowerCase()}} />
                      {r.color}
                    </span>
                  )}
                  {!r.color && '—'}
                </td>
                <td className="px-4 py-3 font-semibold">{Number(r.meters).toFixed(1)} м</td>
                <td className="px-4 py-3 text-gray-500">{r.consumption_per_unit ? `${r.consumption_per_unit} м` : '—'}</td>
                <td className="px-4 py-3 text-green-600 font-semibold">{r.expected_units > 0 ? `${r.expected_units} шт` : '—'}</td>
                <td className="px-4 py-3 text-gray-400">{r.order_number ? `№${r.order_number}` : '—'}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(r.shipment_date).toLocaleDateString('ru-RU')}</td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteRoll(r.id)} className="text-red-400 hover:text-red-600 text-xs">Удалить</button>
                </td>
              </tr>
            ))}
            {!rolls.length && <tr><td colSpan="9" className="px-4 py-8 text-center text-gray-300">Рулонов пока нет</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Добавить рулон ткани</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Название ткани</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Хлопок, шёлк..."
                    value={form.fabric_name} onChange={e=>setForm({...form,fabric_name:e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Цвет</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Белый, синий..."
                    value={form.color} onChange={e=>setForm({...form,color:e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Номер рулона *</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.roll_number} onChange={e=>setForm({...form,roll_number:e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Метраж (м) *</label>
                  <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.meters} onChange={e=>setForm({...form,meters:e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Расход на ед. (м)</label>
                  <input type="number" step="0.001" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1.5"
                    value={form.consumption_per_unit} onChange={e=>setForm({...form,consumption_per_unit:e.target.value})} />
                </div>
              </div>

              {/* Расчёт выхода */}
              {form.meters && form.consumption_per_unit && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  📊 Расчётный выход: <strong>{Math.floor(Number(form.meters) / Number(form.consumption_per_unit))} изделий</strong> из {Number(form.meters)} м при расходе {form.consumption_per_unit} м/ед.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Привязать к заказу</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.order_id} onChange={e=>setForm({...form,order_id:e.target.value})}>
                    <option value="">Не указан</option>
                    {orders.map(o=><option key={o.id} value={o.id}>№{o.order_number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Дата</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.shipment_date} onChange={e=>setForm({...form,shipment_date:e.target.value})} />
                </div>
              </div>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Примечание"
                value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
