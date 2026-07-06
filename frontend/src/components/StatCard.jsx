export default function StatCard({ title, value, sub, accent = 'navy' }) {
  const colors = { navy:'text-navy', gold:'text-gold', green:'text-green-600', red:'text-red-600', blue:'text-blue-600' };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-400">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${colors[accent]||colors.navy}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
