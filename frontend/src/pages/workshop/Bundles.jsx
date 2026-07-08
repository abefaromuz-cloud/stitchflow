import { useEffect, useState } from 'react';
import api from '../../api/client';

const STATUS_LABELS = { cut:'Покроено', sewing:'Пошив', vto:'ВТО/ОТК', shipped:'Отгружен' };
const STATUS_COLORS = { cut:'bg-purple-100 text-purple-700', sewing:'bg-blue-100 text-blue-700', vto:'bg-yellow-100 text-yellow-700', shipped:'bg-green-100 text-green-700' };

export default function Bundles({ onSelectBundle }) {
  const [bundles, setBundles] = useState([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  function load() {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    api.get(`/workshop/bundles${params}`).then(r => setBundles(r.data));
  }
  useEffect(() => { load(); }, [statusFilter]);

  const filtered = bundles.filter(b =>
    !filter ||
    b.bundle_number.toLowerCase().includes(filter.toLowerCase()) ||
    b.product_name?.toLowerCase().includes(filter.toLowerCase()) ||
    b.color?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <h2 className="text-lg font-semibold text-navy">Пачки / Пошив</h2>
        <div className="flex gap-2">
          <input className="border rounded-lg px-3 py-2 text-sm w-48" placeholder="🔍 Поиск пачки..."
            value={filter} onChange={e=>setFilter(e.target.value)} />
          <select className="border rounded-lg px-3 py-2 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {['cut','sewing','vto'].map(st => (
          <div key={st} className={`rounded-xl border p-3 text-center ${STATUS_COLORS[st]} border-transparent`}>
            <p className="text-2xl font-bold">{bundles.filter(b=>b.status===st).length}</p>
            <p className="text-xs mt-0.5">{STATUS_LABELS[st]}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-400 text-left">
            <tr>
              <th className="px-4 py-3">Пачка</th>
              <th className="px-4 py-3">Изделие</th>
              <th className="px-4 py-3">Размер</th>
              <th className="px-4 py-3">Цвет</th>
              <th className="px-4 py-3">Кол-во</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Операции</th>
              <th className="px-4 py-3">Сотрудник</th>
              <th className="px-4 py-3">Заказ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => {
              const opDone = Number(b.op_done_count);
              const opTotal = Number(b.op_count);
              return (
                <tr key={b.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={()=>onSelectBundle(b.id)}>
                  <td className="px-4 py-3 font-bold text-navy text-base">{b.bundle_number}</td>
                  <td className="px-4 py-3">{b.product_name}</td>
                  <td className="px-4 py-3 font-medium text-indigo-600">{b.size}</td>
                  <td className="px-4 py-3">{b.color||'—'}</td>
                  <td className="px-4 py-3">{b.quantity} шт</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status]||'bg-gray-100'}`}>
                      {STATUS_LABELS[b.status]||b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {opTotal > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-blue-500" style={{width:`${(opDone/opTotal)*100}%`}} />
                        </div>
                        <span className="text-xs text-gray-400">{opDone}/{opTotal}</span>
                      </div>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{b.current_employee_name||'—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{b.order_number?`№${b.order_number}`:'—'}</td>
                  <td className="px-4 py-3 text-navy text-xs font-medium hover:underline">Открыть →</td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-300">Пачек пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
