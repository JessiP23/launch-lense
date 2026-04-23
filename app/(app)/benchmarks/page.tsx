const benchmarkData = [
  { vertical: 'SaaS', avg_ctr: 1.2, avg_cvr: 2.5, avg_cpa: 45, sample_size: 1200 },
  { vertical: 'E-commerce', avg_ctr: 1.8, avg_cvr: 3.2, avg_cpa: 32, sample_size: 2400 },
  { vertical: 'Health', avg_ctr: 0.9, avg_cvr: 1.8, avg_cpa: 58, sample_size: 800 },
  { vertical: 'Fintech', avg_ctr: 1.1, avg_cvr: 2.1, avg_cpa: 52, sample_size: 600 },
  { vertical: 'Education', avg_ctr: 1.4, avg_cvr: 2.8, avg_cpa: 38, sample_size: 950 },
  { vertical: 'Marketplace', avg_ctr: 1.3, avg_cvr: 2.2, avg_cpa: 48, sample_size: 500 },
];

export default function BenchmarksPage() {
  const totalSamples = benchmarkData.reduce((s, b) => s + b.sample_size, 0);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8C8880]">Benchmarks</p>
        <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-[#111110] mt-0.5">
          Meta Ads Performance
        </h1>
        <p className="text-[0.9375rem] text-[#8C8880] mt-1">
          Aggregated from {totalSamples.toLocaleString()} campaigns — used in Go / No-Go verdict calculations.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden">
        <table className="w-full text-[0.875rem]">
          <thead>
            <tr className="border-b border-[#E8E4DC] bg-[#FAFAF8]">
              {['Vertical', 'Avg CTR', 'Avg CVR', 'Avg CPA', 'Sample'].map((h, i) => (
                <th
                  key={h}
                  className={`py-3 px-5 text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[#8C8880] ${i === 0 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {benchmarkData.map((b, i) => (
              <tr
                key={b.vertical}
                className={`hover:bg-[#F3F0EB] transition-colors ${i < benchmarkData.length - 1 ? 'border-b border-[#E8E4DC]' : ''}`}
              >
                <td className="py-3 px-5 font-medium text-[#111110]">{b.vertical}</td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-[#111110]">{b.avg_ctr.toFixed(1)}%</td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-[#111110]">{b.avg_cvr.toFixed(1)}%</td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-[#111110]">${b.avg_cpa}</td>
                <td className="py-3 px-5 text-right font-mono tabular-nums text-[#8C8880]">{b.sample_size.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
