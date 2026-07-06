import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/client';
import StatCard from '../components/StatCard';

const EXP_CATS = { rent:'Аренда', utilities:'Коммунальные', materials:'Материалы', equipment:'Оборудование', salary:'Зарплаты', other:'Прочее' };

export default function Finance() {
  const [overview, setOverview] = useState(null);
  const [summary, setSummary] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showExpModal, setShowExpModal] = useState(false);
  const [expForm, setExpForm] = useState({ category:'rent', amount:'', description:'', expense_date:'' });
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([api.get('/finance/overview'), api.get('/finance/summary'), api.get('/invoices')])
      .then(([o,s,inv])=>{ setOverview(o.data); setSummary(s.data); setInvoices(inv.data); })
      .finally(()=>setLoading(false));
  }
  useEffect(()=>{ load(); },[]);

  async function addExpense(e) {
    e.preventDefault();
    try { await api.post('/finance/expenses', expForm); setShowExpModal(false); load(); }
    catch(err) { alert(err.response?.data?.error||'Ошибка'); }
  }

  async function updateInvoiceStatus(id, status) {
    try { await api.put(`/invoices/${id}/status`, { status }); load(); }
    catch(err) { alert(err.response?.data?.error||'Ошибка'); }
  }

  if (loading) return <p className="text-gray-400">Загрузка...</p>;

  const chartData = summary.map(s=>({
    month: new Date(s.period).toLocaleDateString('ru-RU',{month:'short'}),
    Доход: Number(s.revenue), Расходы: Number(s.expenses), Прибыль: Number(s.profit)
  }));

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Финансы</h1>
        <button onClick={()=>setShowExpModal(true)} className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium">+ Расход</button>
      </div>

      {overview && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard title="Доход (месяц)" value={`₽${Number(overview.revenue).toLocaleString()}`} accent="gold" />
          <StatCard title="Расходы (месяц)" value={`₽${Number(overview.expenses).toLocaleString()}`} accent="red" />
          <StatCard title="Прибыль (месяц)" value={`₽${Number(overview.profit).toLocaleString()}`} accent={overview.profit>=0?'green':'red'} />
          <StatCard title="Долги клиентов" value={`₽${Number(overview.client_debts).toLocaleString()}`} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="font-semibold text-navy mb-3">Доходы / Расходы / Прибыль</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{fontSize:11}} />
              <YAxis tick={{fontSize:11}} />
              <Tooltip formatter={v=>`₽${Number(v).toLocaleString()}`} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Line type="monotone" dataKey="Доход" stroke="#D4AF37" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Расходы" stroke="#DC2626" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Прибыль" stroke="#0F1F3D" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {overview && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="font-semibold text-navy mb-3">Расходы по категориям</p>
            <div className="space-y-2">
              {overview.expenses_by_category.map(e=>(
                <div key={e.category} className="flex justify-between text-sm">
                  <span className="text-gray-500">{EXP_CATS[e.category]||e.category}</span>
                  <span className="font-semibold text-navy">₽{Number(e.total).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Счета */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-navy mb-3">Счета клиентам</h2>
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-left">
            <tr><th className="py-2">Номер</th><th className="py-2">Клиент</th><th className="py-2">Сумма</th><th className="py-2">Срок</th><th className="py-2">Статус</th><th className="py-2"></th></tr>
          </thead>
          <tbody>
            {invoices.map(inv=>(
              <tr key={inv.id} className="border-t">
                <td className="py-2 font-medium text-navy">{inv.invoice_number}</td>
                <td className="py-2">{inv.client_name}</td>
                <td className="py-2 font-semibold">₽{Number(inv.total_amount).toLocaleString()}</td>
                <td className="py-2 text-gray-400">{inv.due_date?new Date(inv.due_date).toLocaleDateString('ru-RU'):'—'}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    inv.status==='paid'?'bg-green-100 text-green-700':
                    inv.status==='overdue'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'
                  }`}>
                    {inv.status==='paid'?'Оплачен':inv.status==='overdue'?'Просрочен':'Не оплачен'}
                  </span>
                </td>
                <td className="py-2">
                  <div className="flex gap-1">
                    <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer"
                      className="text-xs bg-navy/5 hover:bg-navy/10 text-navy px-2 py-1 rounded font-medium">PDF</a>
                    {inv.status!=='paid' && (
                      <button onClick={()=>updateInvoiceStatus(inv.id,'paid')}
                        className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2 py-1 rounded font-medium">Оплачен</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showExpModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Новый расход</h2>
            <form onSubmit={addExpense} className="space-y-3">
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={expForm.category} onChange={e=>setExpForm({...expForm,category:e.target.value})}>
                {Object.entries(EXP_CATS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
              <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Сумма (₽) *"
                value={expForm.amount} onChange={e=>setExpForm({...expForm,amount:e.target.value})} required />
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Описание"
                value={expForm.description} onChange={e=>setExpForm({...expForm,description:e.target.value})} />
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={expForm.expense_date} onChange={e=>setExpForm({...expForm,expense_date:e.target.value})} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowExpModal(false)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">Добавить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
