import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const benchmarkData = [
  { vertical: 'SaaS', avg_ctr: 1.2, avg_cvr: 2.5, avg_cpa: 45, sample_size: 1200 },
  { vertical: 'E-commerce', avg_ctr: 1.8, avg_cvr: 3.2, avg_cpa: 32, sample_size: 2400 },
  { vertical: 'Health', avg_ctr: 0.9, avg_cvr: 1.8, avg_cpa: 58, sample_size: 800 },
  { vertical: 'Fintech', avg_ctr: 1.1, avg_cvr: 2.1, avg_cpa: 52, sample_size: 600 },
  { vertical: 'Education', avg_ctr: 1.4, avg_cvr: 2.8, avg_cpa: 38, sample_size: 950 },
  { vertical: 'Marketplace', avg_ctr: 1.3, avg_cvr: 2.2, avg_cpa: 48, sample_size: 500 },
];

export default function BenchmarksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Benchmarks</h1>
        <p className="text-sm text-[#A1A1A1] mt-1">
          Industry benchmarks for Meta ad performance across verticals
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meta Ads Performance Benchmarks</CardTitle>
          <CardDescription>
            Aggregated from {benchmarkData.reduce((s, b) => s + b.sample_size, 0).toLocaleString()} campaigns. Used in Go/No-Go verdict calculations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#262626]">
                <th className="py-2 px-3 text-left text-[#A1A1A1] font-medium">Vertical</th>
                <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium">Avg CTR</th>
                <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium">Avg CVR</th>
                <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium">Avg CPA</th>
                <th className="py-2 px-3 text-right text-[#A1A1A1] font-medium">Sample Size</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkData.map((b) => (
                <tr
                  key={b.vertical}
                  className="border-b border-[#262626]/50 h-10 hover:bg-[#111111] transition-colors"
                >
                  <td className="py-2 px-3 font-medium">{b.vertical}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {b.avg_ctr.toFixed(1)}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {b.avg_cvr.toFixed(1)}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    ${b.avg_cpa}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-[#A1A1A1]">
                    {b.sample_size.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
