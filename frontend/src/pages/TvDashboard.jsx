import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const pub = axios.create({ baseURL: '/api' });

function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i=setInterval(()=>setT(new Date()),1000); return ()=>clearInterval(i); },[]);
  return <span className="text-4xl font-mono text-yellow-400">{t.toLocaleTimeString('ru-RU')}</span>;
}

const STAGE_ICONS = { Раскрой:'✂️', Пошив:'🧵', Оверлок:'🪡', Утюжка:'🔥', 'Контроль QC':'🔍', Упаковка:'📦' };

export default function TvDashboard() {
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    pub.get('/tv').then(r=>setData(r.data)).catch(()=>{});
  },[]);

  useEffect(() => { load(); const i=setInterval(load,30000); return ()=>clearInterval(i); },[load]);

  if (!data) return <div className="min-h-screen bg-[#0A1628] flex items-center justify-center text-white animate-pulse">Загрузка...</div>;

  const planColor = data.today.plan_percent>=80?'bg-green-500':data.today.plan_percent>=50?'bg-yellow-400':'bg-red-500';

  return (
    <div className="min-h-screen bg-[#0A1628] text-white p-6 flex flex-col gap-4 select-none">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-yellow-400">StitchFlow</h1>
          <p className="text-white/40 text-sm">{new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <Clock />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          ['Выполнено сегодня', `${data.today.done} шт`, 'text-yellow-400'],
          ['План дня', `${data.today.planned} шт`, 'text-white'],
          ['Активных заказов', data.month.active_orders, 'text-blue-300'],
          ['Доход за месяц', `₽${Number(data.month.revenue).toLocaleString()}`, 'text-green-400'],
        ].map(([l,v,c])=>(
          <div key={l} className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-white/50 text-sm">{l}</p>
            <p className={`text-3xl font-bold mt-1 ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-white/60">Выполнение плана дня</span>
          <span className="font-bold text-yellow-400">{data.today.plan_percent}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-6">
          <div className={`h-6 rounded-full ${planColor} flex items-center justify-end pr-3 transition-all`}
            style={{width:`${Math.max(data.today.plan_percent,2)}%`}}>
            <span className="text-xs font-bold">{data.today.plan_percent}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-1">
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <h2 className="text-yellow-400 font-bold text-lg mb-4">🏆 Рейтинг месяца</h2>
          {data.leaderboard.length===0
            ? <p className="text-white/40 text-sm">Рассчитайте баллы в Мотивации</p>
            : <div className="space-y-3">{data.leaderboard.map((e,i)=>(
              <div key={e.full_name} className={`flex items-center justify-between rounded-xl p-3 ${i===0?'bg-yellow-400/20 border border-yellow-500/40':'bg-white/5'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</span>
                  <div>
                    <p className={`font-semibold ${i===0?'text-yellow-400':'text-white'}`}>{e.full_name}</p>
                    <p className="text-white/40 text-xs">{e.units_produced} шт {e.tier_icon}</p>
                  </div>
                </div>
                <p className="text-lg font-bold">{e.total_points}</p>
              </div>
            ))}</div>
          }
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <h2 className="text-yellow-400 font-bold text-lg mb-4">⚙️ Активные этапы</h2>
          {data.active_stages.length===0
            ? <p className="text-white/40 text-sm">Нет активных этапов</p>
            : <div className="space-y-3">{data.active_stages.map((s,i)=>(
              <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{STAGE_ICONS[s.stage_label]||'⚙️'}</span>
                  <span className="font-semibold">{s.stage_label}</span>
                </div>
                <p className="text-white/60 text-sm">№{s.order_number} · {s.product_name}</p>
                <p className="text-white/30 text-xs mt-1">{s.hours} ч в работе</p>
              </div>
            ))}</div>
          }
        </div>

        <div className="flex flex-col gap-4">
          <div className={`rounded-2xl p-5 border flex-1 ${data.overdue_orders.length>0?'bg-red-900/30 border-red-500/40':'bg-white/5 border-white/10'}`}>
            <h2 className={`font-bold text-lg mb-3 ${data.overdue_orders.length>0?'text-red-400':'text-yellow-400'}`}>
              {data.overdue_orders.length>0?'⚠️ Просроченные заказы':'✅ Просроченных нет'}
            </h2>
            {data.overdue_orders.map(o=>(
              <div key={o.order_number} className="mb-2">
                <p className="font-medium">№{o.order_number} — {o.product_name}</p>
                <p className="text-red-300 text-sm">{o.client_name} · {new Date(o.due_date).toLocaleDateString('ru-RU')}</p>
              </div>
            ))}
          </div>
          {data.top_employee_ever && (
            <div className="bg-yellow-400/10 rounded-2xl p-5 border border-yellow-400/30">
              <p className="text-yellow-400 text-sm font-medium mb-1">⭐ Рекордсмен</p>
              <p className="text-white text-xl font-bold">{data.top_employee_ever.full_name}</p>
              <p className="text-white/60 text-sm">{Number(data.top_employee_ever.total_done).toLocaleString()} изд. · брак {data.top_employee_ever.defect_rate_percent}%</p>
            </div>
          )}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
            <p className="text-white/50 text-sm">Завершено за месяц</p>
            <p className="text-5xl font-bold text-green-400 mt-1">{data.month.completed_orders}</p>
          </div>
        </div>
      </div>
      <p className="text-center text-white/20 text-xs">Обновляется каждые 30 сек · StitchFlow CRM</p>
    </div>
  );
}
