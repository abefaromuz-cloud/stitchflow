import { useEffect, useState } from 'react';
import api from '../api/client';

const TIER_ICONS = { 0:'', 1:'🥉', 2:'🥈', 3:'🥇' };

export default function Motivation() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [config, setConfig] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [msg, setMsg] = useState('');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()+1);
  const [year, setYear] = useState(now.getFullYear());

  function load() {
    Promise.all([api.get('/points/leaderboard'), api.get('/points/config')])
      .then(([l, c]) => { setLeaderboard(l.data); setConfig(c.data); });
  }
  useEffect(() => { load(); }, []);

  async function calculate() {
    setCalculating(true);
    try { await api.post('/points/calculate', { month, year }); load(); setMsg(`Баллы за ${month}/${year} рассчитаны`); }
    catch(err) { setMsg(err.response?.data?.error||'Ошибка'); }
    finally { setCalculating(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Мотивация и баллы</h1>
        <div className="flex gap-3 items-center">
          <select className="border rounded-lg px-3 py-2 text-sm" value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}
          </select>
          <input type="number" className="border rounded-lg px-3 py-2 text-sm w-24" value={year} onChange={e=>setYear(Number(e.target.value))} />
          <button onClick={calculate} disabled={calculating}
            className="bg-gold text-navy px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
            {calculating?'Расчёт...':'⚡ Рассчитать баллы'}
          </button>
        </div>
      </div>

      {msg && <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">{msg}</div>}

      {/* Формула начисления */}
      {config && (
        <div className="grid grid-cols-3 gap-3">
          {[
            ['⚡ Скорость', `+${config.points_per_unit} балл / изделие`, `Бонус +${config.speed_bonus_points}б при ≥${config.speed_bonus_threshold} шт`],
            ['✅ Качество', `+${config.zero_defect_points}б при 0% брака`, `+${config.low_defect_points}б при браке ≤${config.low_defect_max_percent}%`],
            ['🗓 Посещаемость', `+${config.full_attendance_points}б без нарушений`, `-${config.late_penalty_points} за опоздание / -${config.absent_penalty_points} прогул`],
          ].map(([t,p,e])=>(
            <div key={t} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="font-semibold text-navy">{t}</p>
              <p className="text-green-600 text-sm mt-1">{p}</p>
              <p className="text-gray-400 text-xs mt-0.5">{e}</p>
            </div>
          ))}
        </div>
      )}

      {/* Уровни премий */}
      {config && (
        <div className="grid grid-cols-3 gap-3">
          {[
            ['🥉 Уровень 1', config.tier1_threshold, config.tier1_bonus, 'bg-orange-50 border-orange-200'],
            ['🥈 Уровень 2', config.tier2_threshold, config.tier2_bonus, 'bg-gray-50 border-gray-200'],
            ['🥇 Уровень 3', config.tier3_threshold, config.tier3_bonus, 'bg-yellow-50 border-yellow-200'],
          ].map(([label,pts,bonus,cls])=>(
            <div key={label} className={`rounded-xl border p-4 ${cls}`}>
              <p className="font-bold text-navy">{label}</p>
              <p className="text-gray-500 text-sm">от {pts} баллов</p>
              <p className="text-xl font-bold text-navy mt-1">₽{Number(bonus).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Рейтинг */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-navy">Рейтинг сотрудников</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-400 text-left">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Сотрудник</th>
              <th className="px-4 py-3">Скорость</th>
              <th className="px-4 py-3">Качество</th>
              <th className="px-4 py-3">Посещ.</th>
              <th className="px-4 py-3 font-bold text-navy">ИТОГО</th>
              <th className="px-4 py-3">Изд.</th>
              <th className="px-4 py-3">Брак %</th>
              <th className="px-4 py-3">Переделки %</th>
              <th className="px-4 py-3">Премия</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((e,i)=>(
              <tr key={i} className={`border-t ${i===0?'bg-yellow-50':''}`}>
                <td className="px-4 py-3">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
                <td className="px-4 py-3 font-medium text-navy">{e.full_name}</td>
                <td className="px-4 py-3">{e.speed_points}</td>
                <td className="px-4 py-3">{e.quality_points}</td>
                <td className="px-4 py-3">{e.attendance_points}</td>
                <td className="px-4 py-3 font-bold text-navy">{e.total_points}</td>
                <td className="px-4 py-3">{Number(e.units_produced).toLocaleString()}</td>
                <td className="px-4 py-3 text-red-500">{e.defect_rate_percent}%</td>
                <td className="px-4 py-3 text-amber-500">{e.rework_rate_percent}%</td>
                <td className="px-4 py-3">
                  {Number(e.bonus_amount)>0
                    ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">₽{Number(e.bonus_amount).toLocaleString()} {TIER_ICONS[e.bonus_tier]}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
            {!leaderboard.length && <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-300">Нажмите «Рассчитать баллы»</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
