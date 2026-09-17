'use client';

type RevenuePoint = { category: string; revenue: number };

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function RevenueBarChart({ data }: { data: RevenuePoint[] }) {
  const max = Math.max(...data.map((point) => point.revenue), 1);

  return (
    <figure className="panel chart-panel" aria-labelledby="revenue-title">
      <figcaption>
        <span className="eyebrow">Mandatory metric</span>
        <h2 id="revenue-title">Revenue by course category</h2>
        <p>Fees paid across every enrollment in your current access scope.</p>
      </figcaption>
      <div className="bars" role="img" aria-label="Bar chart of total revenue by course category">
        {data.map((point, index) => (
          <div className="bar-row" key={point.category}>
            <span className="bar-label">{point.category}</span>
            <div className="bar-track">
              <div
                className={`bar bar-${index + 1}`}
                style={{ width: `${Math.max((point.revenue / max) * 100, 2)}%` }}
              />
            </div>
            <strong>{money.format(point.revenue)}</strong>
          </div>
        ))}
      </div>
    </figure>
  );
}

