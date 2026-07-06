import { useEffect, useState } from 'react';
import api from '../api/client';
import StatCard from '../components/StatCard';

export default function Salary() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [msg, setMsg] = useState('');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()+1);
  const [year, setYear] = useState(now.getFullYear());

  function load() {
    setLoading(true);
    api.get(`/salary?month=${month}&year=${year}`).then(r=>setRecords(r.data)).finally(()=>setLoading(false));
  }
  useEffect(()=>{ load(); },[month,year]);

  async function calculate() {
    setCalculating(true);
    try { await api.post('/salary/calculate',{month,year}); load(); setMsg('Зарплата рассчитана'); }
    catch(err) { setMsg(err.response?.data?.error||'Ошибка'); }
    finally { setCalculating(false); }
  }

  async function pay(id) {
    try { await api.put(`/salary/${id}/pay`); load(); }
    catch(err) { alert(err.response?.data?.error||'Ошибка'); }
  }

  const total = records.reduce((s,r)=>s+Number(r.total_amount),0);
  const paid = records.filter(r=>r.status==='paid').reduce((s,r)=>s+Number(r.total_amount),0);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Зарплата</h1>
        <div className="flex gap-3 items-center">
          <select className="border rounded-lg px-3 py-2 text-sm" value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}
          </select>
          <input type="number" className="border rounded-lg px-3 py-2 text-sm w-24" value={year} onChange={e=>setYear(Number(e.target.value))} />
          <button onClick={calculate} disabled={calculating}
            className="bg-gold text-navy px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
            {calculating?'Расчёт...':'⚡ Рассчитать'}
          </button>
        </div>
      </div>

      {msg && <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">{msg}</div>}

      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Итого к выплате" value={`₽${total.toLocaleString()}`} accent="navy" />
        <StatCard title="Выплачено" value={`₽${paid.toLocaleString()}`} accent="green" />
        <StatCard title="Остаток" value={`₽${(total-paid).toLocaleString()}`} accent="gold" />
      </div>

      {/* Формула */}
      <div className="bg-navy rounded-xl p-4 flex items-center justify-center gap-4 text-sm">
        {[['Оклад','text-gold'],['➕','text-white'],['Сдельная','text-gold'],['➕','text-white'],['Премии','text-green-400'],['➖','text-white'],['Штрафы','text-red-400'],['＝','text-white'],['ИТОГО','text-white font-bold']].map(([t,c],i)=>(
          <span key={i} className={c}>{t}</span>
        ))}
      </div>

      {loading ? <p className="text-gray-400">Загрузка...</p> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-left">
              <tr>
                <th className="px-4 py-3">Сотрудник</th>
                <th className="px-4 py-3">Оклад</th>
                <th className="px-4 py-3">Сдельная</th>
                <th className="px-4 py-3">Премии</th>
                <th className="px-4 py-3">Штрафы</th>
                <th className="px-4 py-3 font-bold text-navy">ИТОГО</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r=>(
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-navy">{r.full_name}</td>
                  <td className="px-4 py-3">₽{Number(r.base_salary).toLocaleString()}</td>
                  <td className="px-4 py-3">₽{Number(r.piece_work_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-600">{Number(r.bonus_amount)>0?`₽${Number(r.bonus_amount).toLocaleString()}`:'—'}</td>
                  <td className="px-4 py-3 text-red-500">{Number(r.penalty_amount)>0?`₽${Number(r.penalty_amount).toLocaleString()}`:'—'}</td>
                  <td className="px-4 py-3 font-bold text-navy">₽{Number(r.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status==='paid'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>
                      {r.status==='paid'?'Оплачено':'Ожидает'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status!=='paid' && (
                      <button onClick={()=>pay(r.id)} className="text-xs bg-navy text-white px-3 py-1 rounded-lg hover:opacity-80">
                        Выплатить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-300">Нажмите «Рассчитать» для расчёта зарплаты</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
