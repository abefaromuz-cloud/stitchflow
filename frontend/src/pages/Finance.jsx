import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import api from '../api/client';
import StatCard from '../components/StatCard';

const EXPENSE_CATEGORY_LABELS = {
  rent: 'Аренда',
  utilities: 'Коммунальные услуги',
  materials: 'Материалы',
  salary: 'Зарплата',
  tax: 'Налоги',
  equipment: 'Оборудование',
  other: 'Прочее'
};

const INVOICE_STATUS_LABELS = {
  unpaid: 'Не оплачен',
  paid: 'Оплачен',
  overdue: 'Просрочен',
  cancelled: 'Отменен'
};

const INVOICE_STATUS_COLORS = {
  unpaid: 'bg-gray-100 text-gray-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400'
};

export default function Finance() {
  const [overview, setOverview] = useState(null);
  const [summary, setSummary] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: 'other', amount: '', description: '', expense_date: '' });
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/finance/overview'),
      api.get('/finance/summary'),
      api.get('/finance/expenses'),
      api.get('/invoices')
    ])
      .then(([overviewRes, summaryRes, expensesRes, invoicesRes]) => {
        setOverview(overviewRes.data);
        setSummary(summaryRes.data.map((s) => ({
          month: new Date(s.period).toLocaleDateString('ru-RU', { month: 'short' }),
          revenue: Number(s.revenue),
          expenses: Number(s.expenses),
          profit: Number(s.profit)
        })));
        setExpenses(expensesRes.data);
        setInvoices(invoicesRes.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAddExpense(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/finance/expenses', expenseForm);
      setShowExpenseModal(false);
      setExpenseForm({ category: 'other', amount: '', description: '', expense_date: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Ошибка');
    }
  }

  async function handleMarkPaid(id) {
    try {
      await api.put(`/invoices/${id}/status`, { status: 'paid' });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  }

  if (loading) return <p className="text-gray-500">Загрузка...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">Финансы</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Доход (месяц)" value={`$${overview.revenue.toLocaleString()}`} accent="gold" />
        <StatCard title="Расходы (месяц)" value={`$${overview.expenses.toLocaleString()}`} accent="red" />
        <StatCard title="Прибыль (месяц)" value={`$${overview.profit.toLocaleString()}`} accent={overview.profit >= 0 ? 'green' : 'red'} />
        <StatCard title="Долги клиентов" value={`$${overview.client_debts.toLocaleString()}`} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-navy mb-3">Доходы / Расходы / Прибыль (12 месяцев)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={summary}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="revenue" name="Доход" stroke="#D4AF37" strokeWidth={2} />
            <Line type="monotone" dataKey="expenses" name="Расходы" stroke="#dc2626" strokeWidth={2} />
            <Line type="monotone" dataKey="profit" name="Прибыль" stroke="#0F1F3D" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Расходы */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-navy">Расходы</h2>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="text-xs bg-navy text-white px-3 py-1.5 rounded-lg font-medium"
            >
              + Добавить
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {expenses.map((e) => (
              <div key={e.id} className="flex justify-between items-center text-sm border-b pb-2">
                <div>
                  <p className="font-medium">{e.category_label}</p>
                  <p className="text-xs text-gray-400">{e.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600">-${Number(e.amount).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{new Date(e.expense_date).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>
            ))}
            {expenses.length === 0 && <p className="text-gray-400 text-sm">Расходов пока нет</p>}
          </div>
        </div>

        {/* Расходы по категориям (текущий месяц) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-navy mb-3">Расходы по категориям (месяц)</h2>
          <div className="space-y-2">
            {overview.expenses_by_category.map((c) => (
              <div key={c.category} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{c.label}</span>
                <span className="font-semibold text-navy">${c.total.toLocaleString()}</span>
              </div>
            ))}
            {overview.expenses_by_category.length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
          </div>
          <div className="mt-4 pt-3 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Выплаты сотрудникам</span>
              <span className="font-semibold">{overview.employee_payouts.toLocaleString()} сум</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Налоги (месяц)</span>
              <span className="font-semibold">${overview.taxes.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Счета */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-navy">Счета</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">№ Счета</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Заказ</th>
              <th className="px-4 py-3">Сумма к оплате</th>
              <th className="px-4 py-3">Срок</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                <td className="px-4 py-3">{inv.client_name}</td>
                <td className="px-4 py-3 text-gray-500">{inv.order_number ? `№${inv.order_number}` : '—'}</td>
                <td className="px-4 py-3 font-semibold">${Number(inv.total_amount).toLocaleString()}</td>
                <td className="px-4 py-3">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('ru-RU') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <a
                    href={`/api/invoices/${inv.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-navy underline"
                  >
                    PDF
                  </a>
                  {inv.status === 'unpaid' && (
                    <button onClick={() => handleMarkPaid(inv.id)} className="text-xs text-green-600 underline">
                      Оплачен
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center text-gray-400">Счетов пока нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Новый расход</h2>
            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Категория</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                >
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Сумма ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Описание</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Дата</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="px-4 py-2 text-sm rounded-lg border">
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
