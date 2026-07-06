import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('admin@stitchflow.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('sf_token', data.token);
      localStorage.setItem('sf_user', JSON.stringify(data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка входа');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-navy">StitchFlow</h1>
          <p className="text-gray-400 text-sm mt-1">Контроль каждого стежка</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Пароль</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold" required />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-navy text-white rounded-lg py-2.5 font-medium hover:bg-navy/90 transition disabled:opacity-50">
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        <p className="text-xs text-gray-300 text-center mt-6">admin@stitchflow.local / admin123</p>
      </div>
    </div>
  );
}
