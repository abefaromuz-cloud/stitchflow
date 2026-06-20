import { useEffect, useState } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../api/client';

const TIER_COLORS = {
  0: 'bg-gray-100 text-gray-500',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-purple-100 text-purple-700',
  3: 'bg-gold/20 text-yellow-700'
};

const TIER_LABELS = {
  0: 'Без премии',
  1: '🥉 Уровень 1',
  2: '🥈 Уровень 2',
  3: '🥇 Уровень 3'
};

const REDEMPTION_LABELS = {
  cash_bonus: '💰 Денежная премия',
  day_off: '🌴 Выходной',
  gift: '🎁 Подарок'
};

export default function Motivation() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [config, setConfig] = useState(null);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [tab, setTab] = useState('rating'); // rating | config | history
  const [configForm, setConfigForm] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [redeemModal, setRedeemModal] = useState(null);
  const [redeemForm, setRedeemForm] = useState({ redemption_type: 'cash_bonus', description: '', value_amount: '' });
  const [message, setMessage] = useState('');
  const [employees, setEmployees] = useState([]);

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/points/leaderboard'),
      api.get('/points/config'),
      api.get('/points/redemptions'),
      api.get('/employees')
    ])
      .then(([lbRes, cfgRes, redRes, empRes]) => {
        setLeaderboard(lbRes.data);
        setConfig(cfgRes.data);
        setConfigForm(cfgRes.data);
        setRedemptions(redRes.data);
        setEmployees(empRes.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCalculate() {
    setCalculating(true);
    setMessage('');
    try {
      await api.post('/points/calculate', {});
      setMessage('Баллы успешно рассчитаны');
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Ошибка расчёта');
    } finally {
      setCalculating(false);
    }
  }

  async function handleSaveConfig(e) {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.put('/points/config', configForm);
      setMessage('Настройки сохранены');
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleRedeem(e) {
    e.preventDefault();
    try {
      const now = new Date();
      await api.post('/points/redeem', {
        employee_id: redeemModal.employee_id,
        period_month: now.getMonth() + 1,
        period_year: now.getFullYear(),
        ...redeemForm,
        value_amount: redeemForm.value_amount ? Number(redeemForm.value_amount) : null
      });
      setRedeemModal(null);
      setRedeemForm({ redemption_type: 'cash_bonus', description: '', value_amount: '' });
      setMessage('Премия зафиксирована');
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Ошибка');
    }
  }

  if (loading) return <p className="text-gray-500">Загрузка...</p>;

  const radarData = leaderboard.slice(0, 1).length > 0
    ? [
        { subject: 'Скорость', value: leaderboard[0]?.speed_points || 0 },
        { subject: 'Качество', value: leaderboard[0]?.quality_points || 0 },
        { subject: 'Посещаемость', value: leaderboard[0]?.attendance_points || 0 }
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Мотивация и баллы</h1>
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="bg-gold text-navy px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {calculating ? 'Расчёт...' : '⚡ Рассчитать баллы'}
        </button>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
          {message}
        </div>
      )}

      {/* Пояснение системы */}
      {config && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">Скорость</p>
            <p className="font-medium text-navy">{config.points_per_unit} балл/изделие</p>
            <p className="text-xs text-gray-500">Бонус +{config.speed_bonus_points} б. при {config.speed_bonus_threshold}+ шт</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">Качество</p>
            <p className="font-medium text-navy">+{config.zero_defect_points} б. за 0% брака</p>
            <p className="text-xs text-gray-500">+{config.low_defect_points} б. при браке ≤{config.low_defect_max_percent}%</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">Посещаемость</p>
            <p className="font-medium text-navy">+{config.full_attendance_points} б. за 0 нарушений</p>
            <p className="text-xs text-gray-500">-{config.late_penalty_points} за опоздание / -{config.absent_penalty_points} за прогул</p>
          </div>
        </div>
      )}

      {/* Пороги премий */}
      {config && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          {[
            { tier: 1, threshold: config.tier1_threshold, bonus: config.tier1_bonus, icon: '🥉' },
            { tier: 2, threshold: config.tier2_threshold, bonus: config.tier2_bonus, icon: '🥈' },
            { tier: 3, threshold: config.tier3_threshold, bonus: config.tier3_bonus, icon: '🥇' }
          ].map(t => (
            <div key={t.tier} className={`rounded-xl border p-4 ${TIER_COLORS[t.tier]}`}>
              <p className="font-bold text-lg">{t.icon} Уровень {t.tier}</p>
              <p className="text-xs">от {t.threshold} баллов</p>
              <p className="font-semibold mt-1">{Number(t.bonus).toLocaleString()} сум</p>
            </div>
          ))}
        </div>
      )}

      {/* Табы */}
      <div className="flex gap-2 border-b">
        {[['rating', 'Рейтинг'], ['config', 'Настройки'], ['history', 'История премий']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === key ? 'border-navy text-navy' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* РЕЙТИНГ */}
      {tab === 'rating' && (
        <div className="space-y-4">
          {leaderboard.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
              Нажмите «Рассчитать баллы» для расчёта рейтинга за текущий месяц
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Таблица */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Сотрудник</th>
                      <th className="px-4 py-3">Баллы</th>
                      <th className="px-4 py-3">Премия</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((emp, idx) => (
                      <tr key={emp.full_name} className="border-t">
                        <td className="px-4 py-3 font-bold text-gray-400">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{emp.full_name}</p>
                          <p className="text-xs text-gray-400">{emp.position}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-navy text-lg">{emp.total_points}</p>
                          <p className="text-xs text-gray-400">
                            ⚡{emp.speed_points} · ✅{emp.quality_points} · 🗓{emp.attendance_points}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${TIER_COLORS[emp.bonus_tier]}`}>
                            {TIER_LABELS[emp.bonus_tier]}
                          </span>
                          {emp.bonus_amount > 0 && (
                            <p className="text-xs text-green-600 mt-1">{Number(emp.bonus_amount).toLocaleString()} сум</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {emp.bonus_tier > 0 && (
                            <button
                              onClick={() => setRedeemModal({ employee_id: employees.find(e => e.full_name === emp.full_name)?.id, full_name: emp.full_name, bonus_amount: emp.bonus_amount })}
                              className="text-xs text-navy underline"
                            >
                              Выдать
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Радар лидера + бар-чарт */}
              <div className="space-y-4">
                {leaderboard[0] && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <p className="text-sm font-semibold text-navy mb-2">Профиль лидера — {leaderboard[0].full_name}</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                        <Radar name="Баллы" dataKey="value" stroke="#0F1F3D" fill="#0F1F3D" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-navy mb-2">Сравнение выработки</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={leaderboard.map(e => ({ name: e.full_name.split(' ')[0], units: e.units_produced, defect: e.defect_rate_percent }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="units" name="Изделий" fill="#0F1F3D" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* НАСТРОЙКИ */}
      {tab === 'config' && configForm && (
        <form onSubmit={handleSaveConfig} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-navy mb-3">⚡ Скорость (выработка)</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Баллов за 1 изделие</label>
                <input type="number" step="0.1" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={configForm.points_per_unit}
                  onChange={e => setConfigForm({ ...configForm, points_per_unit: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Порог для бонуса (шт)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={configForm.speed_bonus_threshold}
                  onChange={e => setConfigForm({ ...configForm, speed_bonus_threshold: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Бонус баллов за порог</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={configForm.speed_bonus_points}
                  onChange={e => setConfigForm({ ...configForm, speed_bonus_points: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-navy mb-3">✅ Качество (брак)</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Баллов за 0% брака</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={configForm.zero_defect_points}
                  onChange={e => setConfigForm({ ...configForm, zero_defect_points: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Макс. % брака (хорошее)</label>
                <input type="number" step="0.1" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={configForm.low_defect_max_percent}
                  onChange={e => setConfigForm({ ...configForm, low_defect_max_percent: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Баллов за брак ≤ порога</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={configForm.low_defect_points}
                  onChange={e => setConfigForm({ ...configForm, low_defect_points: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-navy mb-3">🗓 Посещаемость</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Баллов за 0 нарушений</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={configForm.full_attendance_points}
                  onChange={e => setConfigForm({ ...configForm, full_attendance_points: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Штраф за опоздание</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={configForm.late_penalty_points}
                  onChange={e => setConfigForm({ ...configForm, late_penalty_points: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Штраф за прогул</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={configForm.absent_penalty_points}
                  onChange={e => setConfigForm({ ...configForm, absent_penalty_points: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-navy mb-3">🏆 Пороги премий (баллы → сумма в сумах)</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { tier: 1, thKey: 'tier1_threshold', bonKey: 'tier1_bonus', icon: '🥉' },
                { tier: 2, thKey: 'tier2_threshold', bonKey: 'tier2_bonus', icon: '🥈' },
                { tier: 3, thKey: 'tier3_threshold', bonKey: 'tier3_bonus', icon: '🥇' }
              ].map(t => (
                <div key={t.tier} className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">{t.icon} Уровень {t.tier}</p>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Мин. баллов</label>
                    <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={configForm[t.thKey]}
                      onChange={e => setConfigForm({ ...configForm, [t.thKey]: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Сумма премии (сум)</label>
                    <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={configForm[t.bonKey]}
                      onChange={e => setConfigForm({ ...configForm, [t.bonKey]: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingConfig}
            className="bg-navy text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-navy/90 disabled:opacity-50"
          >
            {savingConfig ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </form>
      )}

      {/* ИСТОРИЯ */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Сотрудник</th>
                <th className="px-4 py-3">Период</th>
                <th className="px-4 py-3">Тип премии</th>
                <th className="px-4 py-3">Описание</th>
                <th className="px-4 py-3">Сумма</th>
                <th className="px-4 py-3">Дата</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{r.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.period_month}/{r.period_year}</td>
                  <td className="px-4 py-3">{REDEMPTION_LABELS[r.redemption_type]}</td>
                  <td className="px-4 py-3 text-gray-500">{r.description || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-green-600">
                    {r.value_amount ? `${Number(r.value_amount).toLocaleString()} сум` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
              {redemptions.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-gray-400">История премий пуста</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Модал выдачи премии */}
      {redeemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-navy mb-1">Выдать премию</h2>
            <p className="text-sm text-gray-500 mb-4">{redeemModal.full_name} · {Number(redeemModal.bonus_amount).toLocaleString()} сум</p>
            <form onSubmit={handleRedeem} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={redeemForm.redemption_type}
                  onChange={e => setRedeemForm({ ...redeemForm, redemption_type: e.target.value })}>
                  <option value="cash_bonus">💰 Денежная премия</option>
                  <option value="day_off">🌴 Выходной день</option>
                  <option value="gift">🎁 Подарок</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Описание</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={redeemForm.description}
                  onChange={e => setRedeemForm({ ...redeemForm, description: e.target.value })}
                  placeholder="Премия за высокую выработку" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Сумма (сум)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={redeemForm.value_amount}
                  onChange={e => setRedeemForm({ ...redeemForm, value_amount: e.target.value })}
                  placeholder={redeemModal.bonus_amount} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setRedeemModal(null)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">Зафиксировать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
