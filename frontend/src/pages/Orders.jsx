import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const STATUS_LABELS = { new:'Новый', in_progress:'В работе', cutting:'Раскрой', sewing:'Пошив', qc:'Проверка QC', packing:'Упаковка', completed:'Завершён' };
const STATUS_COLORS = { new:'bg-gray-100 text-gray-600', in_progress:'bg-blue-100 text-blue-700', cutting:'bg-purple-100 text-purple-700', sewing:'bg-indigo-100 text-indigo-700', qc:'bg-yellow-100 text-yellow-700', packing:'bg-orange-100 text-orange-700', completed:'bg-green-100 text-green-700' };

const emptyItem = () => ({ article:'', product_name:'', color:'', quantity:'', unit_price:'' });

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ order_number:'', client_id:'', due_date:'', description:'' });
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    Promise.all([api.get('/orders'), api.get('/clients')])
      .then(([o, c]) => { setOrders(o.data); setClients(c.data); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function addItem() { setItems([...items, emptyItem()]); }
  function removeItem(i) { if (items.length > 1) setItems(items.filter((_,idx)=>idx!==i)); }
  function updateItem(i, field, value) { const arr=[...items]; arr[i]={...arr[i],[field]:value}; setItems(arr); }

  const totalAmount = items.reduce((s,it) => s + ((Number(it.quantity)||0)*(Number(it.unit_price)||0)), 0);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    const validItems = items.filter(it=>it.product_name&&it.quantity&&it.unit_price);
    if (!validItems.length) return setError('Добавьте хотя бы одно изделие с названием, количеством и ценой');
    try {
      await api.post('/orders', { ...form, items: validItems.map(it=>({ ...it, quantity:Number(it.quantity), unit_price:Number(it.unit_price) })) });
      setShowModal(false);
      setForm({ order_number:'', client_id:'', due_date:'', description:'' });
      setItems([emptyItem()]);
      load();
    } catch (err) { setError(err.response?.data?.error||'Ошибка'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Заказы</h1>
        <button onClick={()=>setShowModal(true)} className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy/90">
          + Новый заказ
        </button>
      </div>

      {loading ? <p className="text-gray-400">Загрузка...</p> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-left">
              <tr>
                <th className="px-4 py-3">№ Заказа</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Изделия</th>
                <th className="px-4 py-3">Кол-во</th>
                <th className="px-4 py-3">Сумма</th>
                <th className="px-4 py-3">Срок</th>
                <th className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/orders/${o.id}`} className="text-navy font-medium hover:underline">№{o.order_number}</Link>
                  </td>
                  <td className="px-4 py-3">{o.client_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{o.product_name}</td>
                  <td className="px-4 py-3">{o.quantity} шт</td>
                  <td className="px-4 py-3 font-semibold">₽{Number(o.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-400">{o.due_date ? new Date(o.due_date).toLocaleDateString('ru-RU') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]||'bg-gray-100'}`}>
                      {STATUS_LABELS[o.status]||o.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-300">Заказов пока нет</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Новый заказ</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Номер заказа</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="000150"
                    value={form.order_number} onChange={e=>setForm({...form,order_number:e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Клиент</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})} required>
                    <option value="">Выберите клиента</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Срок сдачи</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.description} onChange={e=>setForm({...form,description:e.target.value})} />
                </div>
              </div>

              {/* Изделия */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-gray-500">Изделия в заказе</label>
                  <button type="button" onClick={addItem} className="text-xs text-navy underline">+ Добавить изделие</button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-gray-50">
                      <div className="grid grid-cols-5 gap-2 mb-2">
                        <input className="border rounded px-2 py-1.5 text-xs" placeholder="Артикул"
                          value={item.article} onChange={e=>updateItem(idx,'article',e.target.value)} />
                        <input className="col-span-2 border rounded px-2 py-1.5 text-xs" placeholder="Название изделия *"
                          value={item.product_name} onChange={e=>updateItem(idx,'product_name',e.target.value)} required />
                        <input className="border rounded px-2 py-1.5 text-xs" placeholder="Цвет"
                          value={item.color} onChange={e=>updateItem(idx,'color',e.target.value)} />
                        <div className="flex gap-1">
                          <button type="button" onClick={()=>removeItem(idx)}
                            className={`text-red-400 hover:text-red-600 text-sm ${items.length===1?'invisible':''}`}>✕</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400">Количество (шт)</label>
                          <input type="number" className="w-full border rounded px-2 py-1.5 text-xs mt-0.5"
                            value={item.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} required min="1" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400">Цена за шт (₽)</label>
                          <input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-xs mt-0.5"
                            value={item.unit_price} onChange={e=>updateItem(idx,'unit_price',e.target.value)} required min="0" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400">Сумма</label>
                          <p className="text-sm font-semibold text-navy mt-1.5">
                            ₽{((Number(item.quantity)||0)*(Number(item.unit_price)||0)).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right mt-2 text-sm font-bold text-navy">
                  Итого: ₽{totalAmount.toLocaleString()}
                </div>
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
