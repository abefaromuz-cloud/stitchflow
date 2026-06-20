import { useEffect, useState } from 'react';
import api from '../api/client';

const CATEGORY_LABELS = {
  fabric: 'Ткани',
  thread: 'Нитки',
  buttons: 'Пуговицы',
  zippers: 'Молнии',
  other: 'Фурнитура'
};

export default function Warehouse() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [movementModal, setMovementModal] = useState(null); // { materialId, type }
  const [movementQty, setMovementQty] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'fabric',
    unit: 'm',
    quantity_in_stock: '',
    min_stock_level: '',
    unit_cost: '',
    supplier: ''
  });
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.get('/materials').then((res) => setMaterials(res.data)).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/materials', form);
      setShowModal(false);
      setForm({ name: '', category: 'fabric', unit: 'm', quantity_in_stock: '', min_stock_level: '', unit_cost: '', supplier: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Ошибка');
    }
  }

  async function handleMovement(e) {
    e.preventDefault();
    try {
      await api.post(`/materials/${movementModal.materialId}/movements`, {
        movement_type: movementModal.type,
        quantity: Number(movementQty),
        reason: movementReason
      });
      setMovementModal(null);
      setMovementQty('');
      setMovementReason('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Ошибка');
    }
  }

  const lowStockCount = materials.filter((m) => m.low_stock).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Склад</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy/90"
        >
          + Новый материал
        </button>
      </div>

      {lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ {lowStockCount} материал(ов) с низким остатком — требуется закупка
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Материал</th>
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3">Остаток</th>
                <th className="px-4 py-3">Мин. остаток</th>
                <th className="px-4 py-3">Цена за ед.</th>
                <th className="px-4 py-3">Поставщик</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className={`border-t ${m.low_stock ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-gray-500">{CATEGORY_LABELS[m.category] || m.category}</td>
                  <td className={`px-4 py-3 font-semibold ${m.low_stock ? 'text-red-600' : 'text-navy'}`}>
                    {Number(m.quantity_in_stock).toLocaleString()} {m.unit}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{Number(m.min_stock_level).toLocaleString()} {m.unit}</td>
                  <td className="px-4 py-3">${Number(m.unit_cost).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">{m.supplier || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setMovementModal({ materialId: m.id, type: 'in' })}
                      className="text-xs text-green-600 underline mr-2"
                    >
                      + Поступление
                    </button>
                    <button
                      onClick={() => setMovementModal({ materialId: m.id, type: 'out' })}
                      className="text-xs text-red-600 underline"
                    >
                      - Списание
                    </button>
                  </td>
                </tr>
              ))}
              {materials.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-400">Материалов пока нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Новый материал</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Название</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Категория</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Единица измерения</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  >
                    <option value="pcs">шт</option>
                    <option value="m">м</option>
                    <option value="kg">кг</option>
                    <option value="roll">рулон</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Остаток</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.quantity_in_stock}
                    onChange={(e) => setForm({ ...form, quantity_in_stock: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Мин. остаток</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.min_stock_level}
                    onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Цена за ед. ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.unit_cost}
                    onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Поставщик</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border">
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

      {movementModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-navy mb-4">
              {movementModal.type === 'in' ? 'Поступление материала' : 'Списание материала'}
            </h2>
            <form onSubmit={handleMovement} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Количество</label>
                <input
                  type="number"
                  step="0.001"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={movementQty}
                  onChange={(e) => setMovementQty(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Причина</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder={movementModal.type === 'in' ? 'Закупка у поставщика' : 'Списание на заказ'}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setMovementModal(null)} className="px-4 py-2 text-sm rounded-lg border">
                  Отмена
                </button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
