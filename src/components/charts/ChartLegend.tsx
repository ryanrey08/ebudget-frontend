export function ChartLegend({ series }: { series: { key: string; label: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-700">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
