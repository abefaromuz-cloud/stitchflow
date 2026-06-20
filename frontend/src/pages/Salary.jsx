import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Salary() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { recordId, type }
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  function load() {
    setLoading(true);
    api.get('/salary').then((res) => setRecords(res.data)).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCalculate() {
    setCalculating(true);
    setError('');
    try {
      await api.post('/salary/calculate', {});
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка расчета');
    } finally {
      setCalculating(false);
    }
  }

  async function handleAdjustment(e) {
    e.preventDefault();
    try {
      await api.post(`/salary/${modal.recordId}/adjustments`, {
        type: modal.type,
        amount: Number(amount),
        reason
      });
      setModal(null);
      setAmount('');
      setReason('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Ошибка');
    }
  }

  async function handlePay(id) {
    try {
      await api.put(`/salary/${id}/pay`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка');
    }
  }

  const total = records.reduce((sum, r) => sum + Number(r.total_amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Зарплата (текущий месяц)</h1>
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy/90 disabled:opacity-50"
        >
          {calculating ? 'Расчет...' : 'Рассчитать зарплату'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <p className="text-sm text-gray-500">Итого к выплате</p>
        <p className="text-2xl font-bold text-gold">{total.toLocaleString()} сум</p>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Сотрудник</th>
                <th className="px-4 py-3">Оклад</th>
                <th className="px-4 py-3">Сдельная</th>
                <th className="px-4 py-3">Премии</th>
                <th className="px-4 py-3">Штрафы</th>
                <th className="px-4 py-3">Итого</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{r.full_name}</td>
                  <td className="px-4 py-3">{Number(r.base_salary).toLocaleString()}</td>
                  <td className="px-4 py-3">{Number(r.piece_work_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-600">
                    +{Number(r.bonus_amount).toLocaleString()}
                    <button onClick={() => setModal({ recordId: r.id, type: 'bonus' })} className="ml-2 text-xs text-navy underline">
                      добавить
                    </button>
                  </td>
                  <td className="px-4 py-3 text-red-600">
                    -{Number(r.penalty_amount).toLocaleString()}
                    <button onClick={() => setModal({ recordId: r.id, type: 'penalty' })} className="ml-2 text-xs text-navy underline">
                      добавить
                    </button>
                  </td>
                  <td className="px-4 py-3 font-bold text-navy">{Number(r.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {r.status === 'paid' ? 'Выплачено' : 'Ожидает'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status !== 'paid' && (
                      <button onClick={() => handlePay(r.id)} className="text-xs text-navy underline">
                        Выплатить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-center text-gray-400">
                    Нет данных за этот месяц. Нажмите «Рассчитать зарплату».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-navy mb-4">
              {modal.type === 'bonus' ? 'Добавить премию' : 'Добавить штраф'}
            </h2>
            <form onSubmit={handleAdjustment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Сумма</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Причина</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={modal.type === 'bonus' ? 'Без брака за месяц' : 'Опоздание'}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg border">
                  Отмена
                </button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
