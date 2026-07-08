import { useEffect, useState } from 'react';
import api from '../../api/client';
import StatCard from '../../components/StatCard';

export default function WorkshopQC({ onSelectBundle }) {
  const [bundles, setBundles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [qcForm, setQcForm] = useState(null); // bundle being QC'd
  const [form, setForm] = useState({ inspector_employee_id:'', checked_quantity:'', passed_quantity:'', defect_quantity:'', rework_quantity:'', notes:'' });
  const [msg, setMsg] = useState('');

  function load() {
    api.get('/workshop/bundles?status=sewing').then(r => setBundles(r.data));
    api.get('/employees').then(r => setEmployees(r.data));
  }
  useEffect(() => { load(); }, []);

  async function submitQC(e) {
    e.preventDefault();
    try {
      await api.post(`/workshop/bundles/${qcForm.id}/qc`, form);
      setQcForm(null);
      setForm({ inspector_employee_id:'', checked_quantity:'', passed_quantity:'', defect_quantity:'', rework_quantity:'', notes:'' });
      load();
      setMsg('ОТК записан');
    } catch (err) { alert(err.response?.data?.error || 'Ошибка'); }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-navy">ВТО / ОТК</h2>

      {msg && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">{msg}</div>}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
        Здесь отображаются пачки в статусе <b>«Пошив»</b>, готовые к проверке качества.
        Нажмите «Провести ОТК» для записи результата.
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
              <th className="px-4 py-3">Операций</th>
              <th className="px-4 py-3">Швея</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {bundles.map(b => {
              const opDone = Number(b.op_done_count);
              const opTotal = Number(b.op_count);
              return (
                <tr key={b.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold text-navy">{b.bundle_number}</td>
                  <td className="px-4 py-3">{b.product_name}</td>
                  <td className="px-4 py-3 text-indigo-600 font-medium">{b.size}</td>
                  <td className="px-4 py-3">{b.color || '—'}</td>
                  <td className="px-4 py-3">{b.quantity} шт</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${opDone===opTotal&&opTotal>0?'text-green-600':'text-gray-400'}`}>
                      {opDone}/{opTotal} {opDone===opTotal&&opTotal>0?'✓':''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{b.current_employee_name||'—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => onSelectBundle(b.id)}
                        className="text-xs text-navy underline">Детали</button>
                      <button onClick={() => setQcForm(b)}
                        className="text-xs bg-yellow-50 border border-yellow-300 text-yellow-700 px-2 py-1 rounded-lg font-medium hover:bg-yellow-100">
                        Провести ОТК
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!bundles.length && <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-300">Пачек для проверки нет</td></tr>}
          </tbody>
        </table>
      </div>

      {/* QC Modal */}
      {qcForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-navy mb-1">ВТО / ОТК — {qcForm.bundle_number}</h2>
            <p className="text-sm text-gray-400 mb-4">{qcForm.product_name} · {qcForm.quantity} шт</p>
            <form onSubmit={submitQC} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Контролёр</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.inspector_employee_id} onChange={e=>setForm({...form,inspector_employee_id:e.target.value})}>
                  <option value="">Не указан</option>
                  {employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Проверено (шт)</label>
                  <input type="number" min="0" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.checked_quantity} onChange={e=>setForm({...form,checked_quantity:e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Прошло ОТК (шт)</label>
                  <input type="number" min="0" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.passed_quantity} onChange={e=>setForm({...form,passed_quantity:e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Брак (шт)</label>
                  <input type="number" min="0" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.defect_quantity} onChange={e=>setForm({...form,defect_quantity:e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">На переделку (шт)</label>
                  <input type="number" min="0" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.rework_quantity} onChange={e=>setForm({...form,rework_quantity:e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Примечание</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows="2"
                  value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setQcForm(null)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
