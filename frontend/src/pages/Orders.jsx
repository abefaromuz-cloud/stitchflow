import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const STATUS_LABELS = {
  new: 'Новый',
  in_progress: 'В работе',
  cutting: 'Раскрой',
  sewing: 'Пошив',
  qc: 'Проверка качества',
  packing: 'Упаковка',
  completed: 'Завершен'
};

const STATUS_COLORS = {
  new: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  cutting: 'bg-purple-100 text-purple-700',
  sewing: 'bg-indigo-100 text-indigo-700',
  qc: 'bg-yellow-100 text-yellow-700',
  packing: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700'
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    order_number: '',
    client_id: '',
    product_name: '',
    quantity: '',
    unit_price: '',
    due_date: '',
    description: ''
  });
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    Promise.all([api.get('/orders'), api.get('/clients')])
      .then(([ordersRes, clientsRes]) => {
        setOrders(ordersRes.data);
        setClients(clientsRes.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/orders', form);
      setShowModal(false);
      setForm({ order_number: '', client_id: '', product_name: '', quantity: '', unit_price: '', due_date: '', description: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Ошибка создания заказа');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Заказы</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy/90"
        >
          + Новый заказ
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">№ Заказа</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Товар</th>
                <th className="px-4 py-3">Кол-во</th>
                <th className="px-4 py-3">Сумма</th>
                <th className="px-4 py-3">Срок</th>
                <th className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/orders/${o.id}`} className="text-navy font-medium hover:underline">
                      №{o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{o.client_name}</td>
                  <td className="px-4 py-3">{o.product_name}</td>
                  <td className="px-4 py-3">{o.quantity} шт</td>
                  <td className="px-4 py-3 font-semibold">${Number(o.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">{o.due_date ? new Date(o.due_date).toLocaleDateString('ru-RU') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-400">Заказов пока нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Новый заказ</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Номер заказа</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.order_number}
                    onChange={(e) => setForm({ ...form, order_number: e.target.value })}
                    placeholder="000146"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Клиент</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    required
                  >
                    <option value="">Выберите клиента</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Товар</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.product_name}
                  onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                  placeholder="Платье Summer Lux"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Количество</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Цена за шт ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Срок</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Описание</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows="2"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border">
                  Отмена
                </button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
