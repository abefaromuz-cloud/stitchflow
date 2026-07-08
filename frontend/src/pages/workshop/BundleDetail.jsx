import { useEffect, useState } from 'react';
import api from '../../api/client';
import StatCard from '../../components/StatCard';

const STATUS_LABELS = { cut:'Покроено', sewing:'Пошив', vto:'ВТО/ОТК', shipped:'Отгружен' };

const DEFAULT_OPERATIONS = [
  'Намелить складки', 'Складки по разметке', 'Складки по рукавом',
  'Сборка плечевые', 'Втачать рукав по изделию',
  'Сборка по боковым по переду изделия', 'Обработка низ рукава',
  'Сборка обточки с подбортом', 'Пришить подборт к изделию на 0,7',
  'Отстрочка на 0,1 по подборту', 'Подшить низ и рукава на 0,7',
  'Закрепка на плечевых, этикетка', 'Утюг', 'Петли', 'Намелка', 'Пуговицы', 'ОТК'
];

export default function BundleDetail({ bundleId, onBack }) {
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOpsForm, setShowOpsForm] = useState(false);
  const [showReclForm, setShowReclForm] = useState(false);
  const [ops, setOps] = useState([]);
  const [reclForm, setReclForm] = useState({ employee_id:'', quantity:1, defect_type:'', description:'' });
  const [msg, setMsg] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get(`/workshop/bundles/${bundleId}`),
      api.get('/employees')
    ]).then(([d, e]) => {
      setData(d.data);
      setEmployees(e.data);
      // Инициализируем форму операций из существующих или дефолтных
      if (d.data.operations?.length > 0) {
        setOps(d.data.operations.map(o => ({
          operation_number: o.operation_number,
          operation_name: o.operation_name,
          employee_id: o.employee_id || '',
          is_done: o.is_done,
          id: o.id
        })));
      } else {
        setOps(DEFAULT_OPERATIONS.map((name, i) => ({
          operation_number: i + 1, operation_name: name, employee_id: '', is_done: false
        })));
      }
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [bundleId]);

  async function saveOperations() {
    try {
      await api.post(`/workshop/bundles/${bundleId}/operations`, { operations: ops });
      // Перевести статус пачки в "sewing"
      if (data.bundle.status === 'cut') {
        await api.put(`/workshop/bundles/${bundleId}`, { status: 'sewing' });
      }
      setShowOpsForm(false);
      load();
      setMsg('Операции сохранены');
    } catch (err) { alert(err.response?.data?.error || 'Ошибка'); }
  }

  async function toggleOp(op) {
    if (!op.id) return;
    try {
      await api.put(`/workshop/bundles/${bundleId}/operations/${op.id}`, { is_done: !op.is_done });
      load();
    } catch (err) { alert('Ошибка'); }
  }

  async function setOpEmployee(op, employeeId) {
    if (!op.id) return;
    try {
      await api.put(`/workshop/bundles/${bundleId}/operations/${op.id}`, { employee_id: employeeId || null });
      load();
    } catch (err) {}
  }

  async function addReclamation(e) {
    e.preventDefault();
    try {
      await api.post(`/workshop/bundles/${bundleId}/reclamations`, reclForm);
      setShowReclForm(false);
      setReclForm({ employee_id:'', quantity:1, defect_type:'', description:'' });
      load();
      setMsg('Рекламация добавлена');
    } catch (err) { alert(err.response?.data?.error || 'Ошибка'); }
  }

  async function updateStatus(status) {
    try {
      await api.put(`/workshop/bundles/${bundleId}`, { status });
      load();
    } catch (err) { alert('Ошибка'); }
  }

  function addOpsRow() {
    setOps([...ops, { operation_number: ops.length + 1, operation_name: '', employee_id: '', is_done: false }]);
  }

  function removeOpsRow(i) {
    const updated = ops.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, operation_number: idx + 1 }));
    setOps(updated);
  }

  if (loading) return <p className="text-gray-400">Загрузка...</p>;
  if (!data) return null;

  const { bundle, operations, reclamations } = data;
  const donOps = operations.filter(o => o.is_done).length;

  return (
    <div className="space-y-5">
      {/* Шапка */}
      <div className="flex justify-between items-start">
        <div>
          <button onClick={onBack} className="text-sm text-gray-400 hover:text-navy mb-2 flex items-center gap-1">
            ← Назад к пачкам
          </button>
          <h1 className="text-2xl font-bold text-navy">Пачка {bundle.bundle_number}</h1>
          <p className="text-gray-400">{bundle.product_name} · {bundle.size} · {bundle.color||'без цвета'}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {operations.length > 0 && (
            <a href={`/api/workshop/bundles/${bundleId}/pdf/route-sheet`} target="_blank" rel="noreferrer"
              className="bg-navy text-white px-3 py-2 rounded-lg text-sm font-medium">
              🖨️ Маршрутный лист
            </a>
          )}
          {reclamations.length > 0 && (
            <a href={`/api/workshop/bundles/${bundleId}/pdf/reclamation`} target="_blank" rel="noreferrer"
              className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium">
              🖨️ Акт рекламации
            </a>
          )}
          <button onClick={() => setShowReclForm(true)}
            className="border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm hover:bg-red-50">
            + Рекламация
          </button>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">{msg}</div>}

      {/* Статусы */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-medium text-gray-400 mb-3">Статус пачки</p>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_LABELS).map(([st, label]) => (
            <button key={st} onClick={() => updateStatus(st)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                bundle.status === st ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-500 hover:border-navy'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Карточки */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard title="Количество в пачке" value={`${bundle.quantity} шт`} />
        <StatCard title="Размер" value={bundle.size || '—'} />
        <StatCard title="Операций выполнено" value={`${donOps} / ${operations.length}`} accent={donOps===operations.length&&operations.length>0?'green':'navy'} />
        <StatCard title="Рекламаций" value={reclamations.length} accent={reclamations.length>0?'red':'navy'} />
      </div>

      {/* Сотрудник на пачке */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-medium text-navy mb-2">Швея на пачке</p>
        <select className="border rounded-lg px-3 py-2 text-sm w-64"
          value={bundle.current_employee_id || ''}
          onChange={async e => { await api.put(`/workshop/bundles/${bundleId}`, { current_employee_id: e.target.value || null }); load(); }}>
          <option value="">Не назначена</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>

      {/* Операции пошива */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-navy">Операции пошива ({operations.length})</h2>
          <button onClick={() => setShowOpsForm(!showOpsForm)}
            className="text-sm text-navy border border-navy px-3 py-1.5 rounded-lg hover:bg-navy hover:text-white transition">
            {showOpsForm ? 'Скрыть редактор' : '✏️ Редактировать список'}
          </button>
        </div>

        {/* Редактор операций */}
        {showOpsForm && (
          <div className="mb-5 border rounded-xl p-4 bg-gray-50">
            <p className="text-xs text-gray-400 mb-3">Редактируйте список операций. Можно добавлять и удалять строки.</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {ops.map((op, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400 w-6">{i+1}.</span>
                  <input className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                    value={op.operation_name}
                    onChange={e => { const a=[...ops]; a[i]={...a[i],operation_name:e.target.value}; setOps(a); }} />
                  <button onClick={() => removeOpsRow(i)} className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3">
              <button onClick={addOpsRow} className="text-xs text-navy underline">+ Добавить операцию</button>
              <button onClick={saveOperations} className="bg-navy text-white px-4 py-1.5 rounded-lg text-sm font-medium">
                Сохранить операции
              </button>
            </div>
          </div>
        )}

        {/* Список операций с чекбоксами */}
        {operations.length > 0 ? (
          <div className="space-y-2">
            {operations.map(op => (
              <div key={op.id} className={`flex items-center gap-3 p-3 rounded-xl border transition ${op.is_done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                <button onClick={() => toggleOp(op)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                    op.is_done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                  }`}>
                  {op.is_done && <span className="text-xs">✓</span>}
                </button>
                <span className="text-sm text-gray-400 w-6 flex-shrink-0">{op.operation_number}.</span>
                <span className={`flex-1 text-sm ${op.is_done ? 'line-through text-gray-400' : 'text-navy'}`}>
                  {op.operation_name}
                </span>
                <select
                  className="text-xs border rounded-lg px-2 py-1 text-gray-500 max-w-[160px]"
                  value={op.employee_id || ''}
                  onChange={e => setOpEmployee(op, e.target.value)}>
                  <option value="">Швея...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
                {op.done_at && (
                  <span className="text-xs text-green-500">{new Date(op.done_at).toLocaleDateString('ru-RU')}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-300 mb-3">Операции не заданы</p>
            <button onClick={() => setShowOpsForm(true)} className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium">
              Задать операции
            </button>
          </div>
        )}
      </div>

      {/* Рекламации */}
      {reclamations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-red-600 mb-3">Рекламации ({reclamations.length})</h2>
          <div className="space-y-2">
            {reclamations.map(r => (
              <div key={r.id} className="border border-red-100 rounded-xl p-3 bg-red-50 text-sm">
                <p className="font-medium text-navy">{r.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {r.defect_type && `Тип: ${r.defect_type} · `}
                  {r.employee_name && `Сотрудник: ${r.employee_name} · `}
                  Кол-во: {r.quantity} шт ·
                  {new Date(r.created_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Форма рекламации */}
      {showReclForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-red-600 mb-4">Новая рекламация — {bundle.bundle_number}</h2>
            <form onSubmit={addReclamation} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Сотрудник</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={reclForm.employee_id} onChange={e=>setReclForm({...reclForm,employee_id:e.target.value})}>
                    <option value="">Не указан</option>
                    {employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Тип дефекта</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Строчка, ткань..."
                    value={reclForm.defect_type} onChange={e=>setReclForm({...reclForm,defect_type:e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Количество (шт)</label>
                <input type="number" min="1" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={reclForm.quantity} onChange={e=>setReclForm({...reclForm,quantity:Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Описание дефекта *</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows="3" required
                  value={reclForm.description} onChange={e=>setReclForm({...reclForm,description:e.target.value})} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowReclForm(false)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
