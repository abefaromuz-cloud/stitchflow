import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const publicApi = axios.create({ baseURL: '/api' });

const STAGE_ICONS = {
  'Раскрой': '✂️', 'Пошив': '🧵', 'Оверлок': '🪡',
  'Утюжка': '🔥', 'Контроль качества': '🔍', 'Упаковка': '📦'
};

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-4xl font-mono text-gold">
      {time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

export default function TvDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    publicApi.get('/tv')
      .then(r => { setData(r.data); setError(''); })
      .catch(() => setError('Ошибка соединения с сервером'));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // обновляем каждые 30 сек
    return () => clearInterval(interval);
  }, [load]);

  if (error) return (
    <div className="min-h-screen bg-navy flex items-center justify-center text-red-400 text-xl">
      {error}
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-navy flex items-center justify-center text-white text-xl animate-pulse">
      Загрузка...
    </div>
  );

  const planColor = data.today.plan_percent >= 80
    ? 'bg-green-500' : data.today.plan_percent >= 50
    ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-navy text-white p-6 flex flex-col gap-5 select-none">

      {/* Шапка */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gold">StitchFlow</h1>
          <p className="text-white/50 text-sm">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Clock />
      </div>

      {/* Главные метрики */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Выполнено сегодня', value: `${data.today.done} шт`, color: 'text-gold' },
          { label: 'План дня', value: `${data.today.planned} шт`, color: 'text-white' },
          { label: 'Активных заказов', value: data.month.active_orders, color: 'text-blue-300' },
          { label: 'Доход за месяц', value: `$${Number(data.month.revenue).toLocaleString()}`, color: 'text-green-400' }
        ].map(m => (
          <div key={m.label} className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-white/50 text-sm">{m.label}</p>
            <p className={`text-3xl font-bold mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Прогресс-бар плана */}
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-white/60">Выполнение плана дня</span>
          <span className="font-bold text-gold">{data.today.plan_percent}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-6">
          <div
            className={`h-6 rounded-full transition-all duration-1000 ${planColor} flex items-center justify-end pr-3`}
            style={{ width: `${Math.max(data.today.plan_percent, 2)}%` }}
          >
            <span className="text-xs font-bold text-white">{data.today.plan_percent}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-1">

        {/* Рейтинг сотрудников */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10 flex flex-col">
          <h2 className="text-gold font-bold text-lg mb-4">🏆 Рейтинг месяца</h2>
          {data.leaderboard.length === 0 ? (
            <p className="text-white/40 text-sm">Данных пока нет — рассчитайте баллы в системе</p>
          ) : (
            <div className="space-y-3 flex-1">
              {data.leaderboard.map((emp, idx) => (
                <div key={emp.full_name} className={`flex items-center justify-between rounded-xl p-3 ${idx === 0 ? 'bg-gold/20 border border-gold/40' : 'bg-white/5'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}</span>
                    <div>
                      <p className={`font-semibold ${idx === 0 ? 'text-gold' : 'text-white'}`}>{emp.full_name}</p>
                      <p className="text-white/40 text-xs">{emp.position} · {emp.units_produced} шт · брак {emp.defect_rate}%</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{emp.total_points}</p>
                    <p className="text-xs text-white/40">баллов {emp.tier_icon}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Активные этапы */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10 flex flex-col">
          <h2 className="text-gold font-bold text-lg mb-4">⚙️ Активные этапы</h2>
          {data.active_stages.length === 0 ? (
            <p className="text-white/40 text-sm">Нет активных этапов</p>
          ) : (
            <div className="space-y-3">
              {data.active_stages.map((s, idx) => (
                <div key={idx} className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{STAGE_ICONS[s.stage_label] || '⚙️'}</span>
                    <span className="font-semibold text-white">{s.stage_label}</span>
                  </div>
                  <p className="text-white/60 text-sm">№{s.order_number} · {s.product_name}</p>
                  <p className="text-white/30 text-xs mt-1">{s.hours} ч в работе</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Правая колонка: просроченные + лучший сотрудник */}
        <div className="flex flex-col gap-4">
          {/* Просроченные */}
          <div className={`rounded-2xl p-5 border flex-1 ${data.overdue_orders.length > 0 ? 'bg-red-900/30 border-red-500/40' : 'bg-white/5 border-white/10'}`}>
            <h2 className={`font-bold text-lg mb-3 ${data.overdue_orders.length > 0 ? 'text-red-400' : 'text-gold'}`}>
              {data.overdue_orders.length > 0 ? '⚠️ Просроченные заказы' : '✅ Просроченных нет'}
            </h2>
            {data.overdue_orders.map(o => (
              <div key={o.order_number} className="mb-2">
                <p className="text-white font-medium">№{o.order_number} — {o.product_name}</p>
                <p className="text-red-300 text-sm">{o.client_name} · срок {new Date(o.due_date).toLocaleDateString('ru-RU')}</p>
              </div>
            ))}
          </div>

          {/* Лучший сотрудник всех времён */}
          {data.top_employee_ever && (
            <div className="bg-gold/10 rounded-2xl p-5 border border-gold/30">
              <p className="text-gold text-sm font-medium mb-1">⭐ Рекордсмен производства</p>
              <p className="text-white text-xl font-bold">{data.top_employee_ever.full_name}</p>
              <p className="text-white/60 text-sm">{Number(data.top_employee_ever.total_done).toLocaleString()} изделий · брак {data.top_employee_ever.defect_rate_percent}%</p>
            </div>
          )}

          {/* Завершённые заказы за месяц */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
            <p className="text-white/50 text-sm">Завершено заказов за месяц</p>
            <p className="text-5xl font-bold text-green-400 mt-1">{data.month.completed_orders}</p>
          </div>
        </div>
      </div>

      <p className="text-center text-white/20 text-xs">
        Обновляется каждые 30 сек · StitchFlow CRM
      </p>
    </div>
  );
}
