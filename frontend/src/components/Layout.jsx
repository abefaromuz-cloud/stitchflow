import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Дашборд', icon: '📊' },
  { to: '/orders', label: 'Заказы', icon: '🧵' },
  { to: '/clients', label: 'Клиенты', icon: '🏢' },
  { to: '/employees', label: 'Сотрудники', icon: '👥' },
  { to: '/attendance', label: 'Посещаемость', icon: '🗓️' },
  { to: '/salary', label: 'Зарплата', icon: '💰' },
  { to: '/warehouse', label: 'Склад', icon: '📦' },
  { to: '/finance', label: 'Финансы', icon: '📈' },
  { to: '/analytics', label: 'AI-аналитика', icon: '🤖' },
  { to: '/motivation', label: 'Мотивация', icon: '🏆' },
  { to: '/telegram', label: 'Telegram', icon: '✈️' },
  { to: '/tv', label: 'ТВ-дашборд', icon: '📺' }
];

export default function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('stitchflow_user') || 'null');

  function handleLogout() {
    localStorage.removeItem('stitchflow_token');
    localStorage.removeItem('stitchflow_user');
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-navy text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-2xl font-bold text-gold">StitchFlow</h1>
          <p className="text-xs text-white/60 mt-1">Контроль каждого стежка</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition ${
                  isActive ? 'bg-gold text-navy font-semibold' : 'text-white/80 hover:bg-white/10'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <p className="text-sm font-medium">{user?.full_name}</p>
          <p className="text-xs text-white/50 mb-3">{user?.role === 'admin' ? 'Администратор' : user?.role}</p>
          <button
            onClick={handleLogout}
            className="w-full text-sm bg-white/10 hover:bg-white/20 rounded-lg py-2 transition"
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
