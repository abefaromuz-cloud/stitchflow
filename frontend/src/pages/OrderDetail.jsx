import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import StatCard from '../components/StatCard';

const STAGE_ICONS = { received:'📥', cutting:'✂️', sewing:'🧵', overlock:'🪡', ironing:'🔥', qc:'🔍', packing:'📦', shipped:'✅' };
const RECL_STATUS = { open:'bg-red-100 text-red-700', in_progress:'bg-yellow-100 text-yellow-700', resolved:'bg-green-100 text-green-700', rejected:'bg-gray-100 text-gray-500' };
const RECL_LABELS = { open:'Открыта', in_progress:'В работе', resolved:'Решена', rejected:'Отклонена' };

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [activeStage, setActiveStage] = useState(null); // stage detail modal
  const [stageData, setStageData] = useState(null);
  const [showRecl, setShowRecl] = useState(false);
  const [reclForm, setReclForm] = useState({ order_item_id:'', employee_id:'', stage_name:'sewing', quantity:1, description:'', defect_type:'' });
  const [showQr, setShowQr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  function load() {
    setLoading(true);
    Promise.all([api.get(`/orders/${id}`), api.get('/employees'), api.get(`/ai/orders/${id}/forecast`).catch(()=>({data:null}))])
      .then(([o, e, f]) => { setOrder(o.data); setEmployees(e.data); setForecast(f.data); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function advanceStage(stage) {
    try { await api.put(`/orders/${id}/stages/${stage.stage_name}`, { status:'done' }); load(); }
    catch (err) { alert(err.response?.data?.error||'Ошибка'); }
  }

  async function openStageDetail(stage) {
    setActiveStage(stage);
    const { data } = await api.get(`/orders/${id}/stage-details/${stage.stage_name}`);
    setStageData(data);
  }

  async function issueInvoice() {
    try {
      const { data } = await api.post('/invoices', { invoice_number:`INV-${order.order_number}`, order_id:order.id, client_id:order.client_id, amount:order.total_amount, due_date:order.due_date });
      window.open(`/api/invoices/${data.id}/pdf`, '_blank');
      setMsg('Счёт выставлен и открыт в новой вкладке');
    } catch (err) { setMsg(err.response?.data?.error||'Ошибка'); }
  }

  async function addReclamation(e) {
    e.preventDefault();
    try {
      await api.post(`/orders/${id}/reclamations`, reclForm);
      setShowRecl(false);
      setReclForm({ order_item_id:'', employee_id:'', stage_name:'sewing', quantity:1, description:'', defect_type:'' });
      load();
    } catch (err) { alert(err.response?.data?.error||'Ошибка'); }
  }

  if (loading) return <p className="text-gray-400">Загрузка...</p>;
  if (!order) return null;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-navy">Заказ №{order.order_number}</h1>
          <p className="text-gray-400 text-sm">{order.client_name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setShowQr(!showQr)} className="border border-gray-200 text-navy px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            QR-код
          </button>
          <button onClick={()=>setShowRecl(true)} className="border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm hover:bg-red-50">
            + Рекламация
          </button>
          <button onClick={issueInvoice} className="bg-gold text-navy px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
            Выставить счёт
          </button>
        </div>
      </div>

      {msg && <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">{msg}</div>}

      {forecast?.message && (
        <div className={`rounded-xl border p-3 text-sm ${forecast.warning?'bg-red-50 border-red-200 text-red-700':'bg-blue-50 border-blue-200 text-blue-700'}`}>
          🤖 {forecast.message} {forecast.warning && `· ⚠️ ${forecast.warning}`}
        </div>
      )}

      {showQr && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col items-center">
          <img src={`/api/qr/orders/${order.id}/image`} alt="QR" className="w-44 h-44" />
          <p className="text-xs text-gray-400 mt-2 text-center">Распечатайте и разместите на изделии — мастер сканирует и отмечает этап</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Итого изделий" value={`${order.quantity} шт`} />
        <StatCard title="Сумма заказа" value={`₽${Number(order.total_amount).toLocaleString()}`} accent="gold" />
        <StatCard title="Выполнено" value={`${order.percent_complete}%`} accent={order.percent_complete>=100?'green':'navy'} />
      </div>

      {/* Позиции заказа */}
      {order.items?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-navy mb-3">Изделия в заказе ({order.items.length})</h2>
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-left">
              <tr>
                <th className="py-2">Артикул</th>
                <th className="py-2">Изделие</th>
                <th className="py-2">Цвет</th>
                <th className="py-2">Кол-во</th>
                <th className="py-2">Цена/шт</th>
                <th className="py-2">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map(it => (
                <tr key={it.id} className="border-t">
                  <td className="py-2 text-gray-400">{it.article||'—'}</td>
                  <td className="py-2 font-medium text-navy">{it.product_name}</td>
                  <td className="py-2 text-gray-500">{it.color||'—'}</td>
                  <td className="py-2">{it.quantity} шт</td>
                  <td className="py-2">₽{Number(it.unit_price).toLocaleString()}</td>
                  <td className="py-2 font-semibold">₽{(Number(it.quantity)*Number(it.unit_price)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Карта производства */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-navy mb-3">Карта производства</h2>
        <p className="text-xs text-gray-400 mb-3">Нажмите на этап чтобы посмотреть детали или отметить выполнение</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {order.stages?.map((stage, idx) => (
            <div key={stage.id} className="flex items-center">
              <button
                onClick={() => stage.status==='in_progress' ? advanceStage(stage) : openStageDetail(stage)}
                className={`flex flex-col items-center px-3 py-2.5 rounded-xl border-2 transition min-w-[90px] ${
                  stage.status==='done'?'bg-green-50 border-green-300':
                  stage.status==='in_progress'?'bg-yellow-50 border-yellow-400 animate-pulse':
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <span className="text-xl">{STAGE_ICONS[stage.stage_name]||'•'}</span>
                <span className="text-xs font-medium mt-1 text-center">{stage.stage_label}</span>
                <span className="text-[10px] text-gray-400 mt-0.5">
                  {stage.status==='done'?'✓ Готово':stage.status==='in_progress'?'▶ В работе':'Ожидание'}
                </span>
              </button>
              {idx < order.stages.length-1 && <span className="text-gray-300 mx-0.5">→</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-300 mt-2">Нажмите «В работе» для завершения этапа · Нажмите любой этап для просмотра деталей</p>
      </div>

      {/* Рекламации */}
      {order.reclamations?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-navy mb-3">Рекламации ({order.reclamations.length})</h2>
          <div className="space-y-2">
            {order.reclamations.map(r => (
              <div key={r.id} className="border rounded-lg p-3 text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-navy">{r.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.item_name && `Изделие: ${r.item_name} · `}
                      {r.employee_name && `Сотрудник: ${r.employee_name} · `}
                      {r.defect_type && `Тип: ${r.defect_type} · `}
                      Кол-во: {r.quantity} шт
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RECL_STATUS[r.status]}`}>
                    {RECL_LABELS[r.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Прогресс сотрудников */}
      {order.progress?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-navy mb-3">Выработка сотрудников</h2>
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-left">
              <tr><th className="py-2">Сотрудник</th><th className="py-2">Этап</th><th className="py-2">Выполнено</th><th className="py-2">Брак</th><th className="py-2">Переделки</th><th className="py-2">Дата</th></tr>
            </thead>
            <tbody>
              {order.progress.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="py-2 font-medium">{p.employee_name}</td>
                  <td className="py-2 text-gray-400">{p.stage_name||'—'}</td>
                  <td className="py-2">{p.quantity_done} шт</td>
                  <td className="py-2 text-red-500">{p.quantity_defect}</td>
                  <td className="py-2 text-amber-500">{p.quantity_rework}</td>
                  <td className="py-2 text-gray-400">{new Date(p.work_date).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stage detail modal */}
      {activeStage && stageData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-navy">{STAGE_ICONS[activeStage.stage_name]} {activeStage.stage_label}</h2>
              <button onClick={()=>{setActiveStage(null);setStageData(null);}} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* Totals by stage type */}
            {activeStage.stage_name==='cutting' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatCard title="Раскроено (всего)" value={`${stageData.totals.cut} шт`} accent="navy" />
                <StatCard title="Выполнено сотрудниками" value={`${stageData.totals.done} шт`} />
              </div>
            )}
            {activeStage.stage_name==='sewing' && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatCard title="Пошито" value={`${stageData.totals.sewn||stageData.totals.done} шт`} accent="navy" />
                <StatCard title="Брак" value={stageData.totals.defect} accent="red" />
                <StatCard title="Переделки" value={stageData.totals.rework} accent="gold" />
              </div>
            )}
            {activeStage.stage_name==='qc' && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatCard title="Проверено" value={`${stageData.totals.qc_checked||stageData.totals.done} шт`} accent="navy" />
                <StatCard title="Прошло QC" value={stageData.totals.qc_passed||0} accent="green" />
                <StatCard title="Брак" value={stageData.totals.qc_defect||stageData.totals.defect} accent="red" />
              </div>
            )}
            {activeStage.stage_name==='qc' && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatCard title="На переделку" value={stageData.totals.qc_rework||0} accent="gold" />
                <StatCard title="На стирку" value={stageData.totals.qc_wash||0} />
                <StatCard title="На правку" value={stageData.totals.qc_fix||0} />
              </div>
            )}
            {activeStage.stage_name==='packing' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatCard title="Упаковано" value={`${stageData.totals.packed||stageData.totals.done} шт`} accent="navy" />
                <StatCard title="Выполнено записей" value={stageData.records.length} />
              </div>
            )}
            {!['cutting','sewing','qc','packing'].includes(activeStage.stage_name) && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatCard title="Выполнено" value={`${stageData.totals.done} шт`} accent="navy" />
                <StatCard title="Брак" value={stageData.totals.defect} accent="red" />
                <StatCard title="Переделки" value={stageData.totals.rework} accent="gold" />
              </div>
            )}

            {/* Records */}
            {stageData.records.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-navy mb-2">Детализация по записям</h3>
                <div className="space-y-2">
                  {stageData.records.map(r => (
                    <div key={r.id} className="border rounded-lg p-3 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium">{r.employee_name||'—'}</span>
                        <span className="text-gray-400">{new Date(r.work_date).toLocaleDateString('ru-RU')}</span>
                      </div>
                      {r.item_name && <p className="text-gray-400 mt-0.5">Изделие: {r.item_name} {r.article&&`(${r.article})`} {r.color&&`· ${r.color}`}</p>}
                      <div className="flex gap-4 mt-1.5 text-gray-600">
                        {r.cut_quantity>0 && <span>Раскроено: {r.cut_quantity}</span>}
                        {r.sewn_quantity>0 && <span>Пошито: {r.sewn_quantity}</span>}
                        {r.quantity_done>0 && <span>Выполнено: {r.quantity_done}</span>}
                        {r.quantity_defect>0 && <span className="text-red-500">Брак: {r.quantity_defect}</span>}
                        {r.quantity_rework>0 && <span className="text-amber-500">Переделки: {r.quantity_rework}</span>}
                        {r.qc_checked>0 && <span>Проверено: {r.qc_checked}</span>}
                        {r.qc_passed>0 && <span className="text-green-600">Прошло: {r.qc_passed}</span>}
                        {r.qc_defect>0 && <span className="text-red-500">Брак: {r.qc_defect}</span>}
                        {r.qc_rework>0 && <span className="text-amber-500">Переделка: {r.qc_rework}</span>}
                        {r.qc_wash>0 && <span>Стирка: {r.qc_wash}</span>}
                        {r.qc_fix>0 && <span>Правка: {r.qc_fix}</span>}
                        {r.packed_quantity>0 && <span>Упаковано: {r.packed_quantity}</span>}
                      </div>
                      {r.notes && <p className="text-gray-400 mt-1">Примечание: {r.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-4">Записей по этому этапу пока нет</p>
            )}
          </div>
        </div>
      )}

      {/* Reclamation modal */}
      {showRecl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Новая рекламация</h2>
            <form onSubmit={addReclamation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Изделие</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={reclForm.order_item_id} onChange={e=>setReclForm({...reclForm,order_item_id:e.target.value})}>
                  <option value="">Весь заказ</option>
                  {order.items?.map(it=><option key={it.id} value={it.id}>{it.product_name} {it.article&&`(${it.article})`}</option>)}
                </select>
              </div>
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">Этап</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={reclForm.stage_name} onChange={e=>setReclForm({...reclForm,stage_name:e.target.value})}>
                    {['cutting','sewing','overlock','ironing','qc','packing'].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Количество</label>
                  <input type="number" min="1" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={reclForm.quantity} onChange={e=>setReclForm({...reclForm,quantity:Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Тип дефекта</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Строчка, ткань..."
                    value={reclForm.defect_type} onChange={e=>setReclForm({...reclForm,defect_type:e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Описание *</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows="3" required
                  value={reclForm.description} onChange={e=>setReclForm({...reclForm,description:e.target.value})} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowRecl(false)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
