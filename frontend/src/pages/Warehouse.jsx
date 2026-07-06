import { useEffect, useState } from 'react';
import api from '../api/client';

const CATS = { fabric:'Ткань', thread:'Нитки', buttons:'Пуговицы', zippers:'Молнии', lining:'Подкладка', other:'Прочее' };
const UNITS = { m:'м', kg:'кг', roll:'рул.', pcs:'шт', l:'л' };

export default function Warehouse() {
  const [materials, setMaterials] = useState([]);
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [movModal, setMovModal] = useState(null);
  const [form, setForm] = useState({ name:'', category:'fabric', unit:'m', quantity_in_stock:'', min_stock_level:'', unit_cost:'', supplier:'', client_id:'', order_id:'', notes:'' });
  const [movForm, setMovForm] = useState({ movement_type:'in', quantity:'', reason:'' });
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    Promise.all([api.get('/materials'), api.get('/clients'), api.get('/orders')])
      .then(([m,c,o])=>{ setMaterials(m.data); setClients(c.data); setOrders(o.data); })
      .finally(()=>setLoading(false));
  }
  useEffect(()=>{ load(); },[]);

  async function handleCreate(e) {
    e.preventDefault(); setError('');
    try { await api.post('/materials', form); setShowModal(false); load(); }
    catch(err) { setError(err.response?.data?.error||'Ошибка'); }
  }

  async function handleMovement(e) {
    e.preventDefault();
    try { await api.post(`/materials/${movModal.id}/movements`, movForm); setMovModal(null); setMovForm({movement_type:'in',quantity:'',reason:''}); load(); }
    catch(err) { alert(err.response?.data?.error||'Ошибка'); }
  }

  const lowStock = materials.filter(m=>m.low_stock);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Склад</h1>
        <button onClick={()=>setShowModal(true)} className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium">+ Материал</button>
      </div>

      {lowStock.length>0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          ⚠️ <b>Низкий остаток:</b> {lowStock.map(m=>m.name).join(', ')}
        </div>
      )}

      {loading ? <p className="text-gray-400">Загрузка...</p> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-left">
              <tr>
                <th className="px-4 py-3">Материал</th>
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3">Остаток</th>
                <th className="px-4 py-3">Мин. остаток</th>
                <th className="px-4 py-3">Цена/ед.</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Заказ</th>
                <th className="px-4 py-3">Поставщик</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map(m=>(
                <tr key={m.id} className={`border-t hover:bg-gray-50 ${m.low_stock?'bg-red-50':''}`}>
                  <td className="px-4 py-3 font-medium text-navy">{m.name}</td>
                  <td className="px-4 py-3 text-gray-400">{CATS[m.category]||m.category}</td>
                  <td className={`px-4 py-3 font-semibold ${m.low_stock?'text-red-600':'text-green-600'}`}>
                    {Number(m.quantity_in_stock)} {UNITS[m.unit]||m.unit}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{Number(m.min_stock_level)} {UNITS[m.unit]||m.unit}</td>
                  <td className="px-4 py-3">₽{Number(m.unit_cost).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.client_name||'—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.order_number?`№${m.order_number}`:'—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.supplier||'—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={()=>setMovModal(m)} className="text-xs bg-navy/5 hover:bg-navy/10 text-navy px-2 py-1 rounded-lg font-medium">
                      + / −
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Добавить материал */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-navy mb-4">Новый материал</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Название *"
                value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
              <div className="grid grid-cols-2 gap-3">
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
                  {Object.entries(CATS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
                <select className="border rounded-lg px-3 py-2 text-sm" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                  {Object.entries(UNITS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input type="number" step="0.001" className="border rounded-lg px-3 py-2 text-sm" placeholder="Остаток"
                  value={form.quantity_in_stock} onChange={e=>setForm({...form,quantity_in_stock:e.target.value})} />
                <input type="number" step="0.001" className="border rounded-lg px-3 py-2 text-sm" placeholder="Мин. остаток"
                  value={form.min_stock_level} onChange={e=>setForm({...form,min_stock_level:e.target.value})} />
                <input type="number" step="0.01" className="border rounded-lg px-3 py-2 text-sm" placeholder="Цена/ед. (₽)"
                  value={form.unit_cost} onChange={e=>setForm({...form,unit_cost:e.target.value})} />
              </div>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Поставщик"
                value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Клиент (чей материал)</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}>
                    <option value="">Не указан</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Привязать к заказу</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.order_id} onChange={e=>setForm({...form,order_id:e.target.value})}>
                    <option value="">Не указан</option>
                    {orders.map(o=><option key={o.id} value={o.id}>№{o.order_number}</option>)}
                  </select>
                </div>
              </div>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Примечание"
                value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Поступление/Списание */}
      {movModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-navy mb-1">{movModal.name}</h2>
            <p className="text-sm text-gray-400 mb-4">Остаток: {Number(movModal.quantity_in_stock)} {UNITS[movModal.unit]||movModal.unit}</p>
            <form onSubmit={handleMovement} className="space-y-3">
              <div className="flex gap-3">
                <button type="button" onClick={()=>setMovForm({...movForm,movement_type:'in'})}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${movForm.movement_type==='in'?'bg-green-600 text-white border-green-600':'border-gray-200'}`}>
                  ➕ Поступление
                </button>
                <button type="button" onClick={()=>setMovForm({...movForm,movement_type:'out'})}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${movForm.movement_type==='out'?'bg-red-600 text-white border-red-600':'border-gray-200'}`}>
                  ➖ Списание
                </button>
              </div>
              <input type="number" step="0.001" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={`Количество (${UNITS[movModal.unit]||movModal.unit})`}
                value={movForm.quantity} onChange={e=>setMovForm({...movForm,quantity:e.target.value})} required />
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Причина"
                value={movForm.reason} onChange={e=>setMovForm({...movForm,reason:e.target.value})} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setMovModal(null)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
