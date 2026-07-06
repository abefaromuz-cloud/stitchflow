import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const pub = axios.create({ baseURL: '/api' });
const INVOICE_STATUS = { unpaid:{label:'Не оплачен',cls:'bg-yellow-100 text-yellow-700'}, paid:{label:'Оплачен',cls:'bg-green-100 text-green-700'}, overdue:{label:'Просрочен',cls:'bg-red-100 text-red-700'} };
const STAGE_ICONS = { received:'📥', cutting:'✂️', sewing:'🧵', overlock:'🪡', ironing:'🔥', qc:'🔍', packing:'📦', shipped:'✅' };
const STAGE_LABELS = { received:'Получен', cutting:'Раскрой', sewing:'Пошив', overlock:'Оверлок', ironing:'Утюжка', qc:'Проверка', packing:'Упаковка', shipped:'Отгружен' };

export default function ClientPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    pub.get(`/client-portal/${token}`)
      .then(r=>setData(r.data))
      .catch(e=>setError(e.response?.data?.error||'Ссылка недействительна'));
  },[token]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center"><p className="text-4xl mb-2">🔒</p><p className="text-gray-700">{error}</p></div>
    </div>
  );
  if (!data) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Загрузка...</p></div>;

  const { client, orders, invoices } = data;
  const active = orders.filter(o=>o.status!=='completed');
  const completed = orders.filter(o=>o.status==='completed');
  const unpaidTotal = invoices.filter(i=>i.status==='unpaid').reduce((s,i)=>s+Number(i.total_amount),0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0F1F3D] text-white px-6 py-5">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div><h1 className="text-xl font-bold text-yellow-400">StitchFlow</h1><p className="text-white/60 text-sm">Кабинет клиента</p></div>
          <div className="text-right"><p className="font-bold">{client.company_name}</p><p className="text-white/60 text-sm">{client.contact_person}</p></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[[active.length,'Активных заказов','text-navy'],[completed.length,'Завершённых','text-green-600'],[`₽${unpaidTotal.toLocaleString()}`,'К оплате','text-yellow-600']].map(([v,l,c])=>(
            <div key={l} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className={`text-2xl font-bold ${c}`}>{v}</p>
              <p className="text-xs text-gray-400 mt-1">{l}</p>
            </div>
          ))}
        </div>

        {active.length>0 && (
          <div>
            <h2 className="font-bold text-navy mb-3">Заказы в производстве</h2>
            {active.map(o=>(
              <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm mb-3 overflow-hidden">
                <button className="w-full text-left p-4" onClick={()=>setExpanded(expanded===o.id?null:o.id)}>
                  <div className="flex justify-between items-start">
                    <div><p className="font-bold text-navy">№{o.order_number}</p><p className="text-sm text-gray-500">{o.product_name}</p></div>
                    <div className="text-right">
                      {o.due_date && <p className="text-xs text-gray-400">срок {new Date(o.due_date).toLocaleDateString('ru-RU')}</p>}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{o.done_qty} из {o.quantity} шт</span>
                      <span className="font-semibold text-navy">{o.percent_complete}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500" style={{width:`${o.percent_complete}%`}} />
                    </div>
                  </div>
                </button>
                {expanded===o.id && o.stages?.length>0 && (
                  <div className="px-4 pb-4 border-t border-gray-50">
                    <p className="text-xs text-gray-400 mt-3 mb-2">Карта производства</p>
                    <div className="flex flex-wrap gap-1.5">
                      {o.stages.map((s,i)=>(
                        <div key={i} className="flex items-center">
                          <div className={`flex flex-col items-center px-2.5 py-2 rounded-lg border min-w-[68px] ${
                            s.status==='done'?'bg-green-50 border-green-200':s.status==='in_progress'?'bg-yellow-50 border-yellow-300':'bg-gray-50 border-gray-200'
                          }`}>
                            <span className="text-lg">{STAGE_ICONS[s.stage_name]||'•'}</span>
                            <span className="text-[9px] font-medium text-center mt-0.5 text-gray-600">{STAGE_LABELS[s.stage_name]||s.stage_name}</span>
                            <span className="text-[8px] text-gray-400">{s.status==='done'?'✓':s.status==='in_progress'?'сейчас':'...'}</span>
                          </div>
                          {i<o.stages.length-1 && <span className="text-gray-300 mx-0.5 text-xs">→</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {invoices.length>0 && (
          <div>
            <h2 className="font-bold text-navy mb-3">Счета</h2>
            {invoices.map(inv=>(
              <div key={inv.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-2 flex justify-between items-center">
                <div>
                  <p className="font-medium text-navy">№{inv.invoice_number}</p>
                  <p className="text-xs text-gray-400">выставлен {new Date(inv.issue_date).toLocaleDateString('ru-RU')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-navy">₽{Number(inv.total_amount).toLocaleString()}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS[inv.status]?.cls}`}>
                    {INVOICE_STATUS[inv.status]?.label}
                  </span>
                  <div className="mt-1">
                    <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-navy underline">PDF</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
