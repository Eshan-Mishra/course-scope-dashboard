'use client';

import type { RegionalPerformance } from '@course-scope/contracts';
import type { CSSProperties } from 'react';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function RegionalFinancialPulse({ data }: { data: RegionalPerformance[] }) {
  const maxYield = Math.max(...data.map((item) => item.revenuePerLearner), 1);

  return (
    <figure className="panel financial-pulse" aria-labelledby="financial-pulse-title">
      <figcaption className="financial-pulse-heading">
        <div>
          <span className="eyebrow">Financial efficiency</span>
          <h2 id="financial-pulse-title">Regional revenue pulse</h2>
        </div>
        <p>Revenue per learner paired with course completion—not revenue volume alone.</p>
      </figcaption>

      <div className="financial-regions">
        {data.map((item) => (
          <article className="financial-region" key={item.region}>
            <div className="financial-region-title">
              <strong>{item.region}</strong>
              <span>{item.learners} learners</span>
            </div>
            <div className="financial-region-core">
              <div>
                <span className="financial-label">Revenue / learner</span>
                <strong className="financial-value">{money.format(item.revenuePerLearner)}</strong>
              </div>
              <div
                className="completion-ring"
                style={{ '--completion': `${item.completionRate * 3.6}deg` } as CSSProperties }
                role="img"
                aria-label={`${item.region} completion rate ${item.completionRate}%`}
              >
                <strong>{item.completionRate}%</strong>
                <span>complete</span>
              </div>
            </div>
            <div className="yield-track" aria-hidden="true">
              <span style={{ width: `${Math.max((item.revenuePerLearner / maxYield) * 100, 4)}%` }} />
            </div>
            <small>{money.format(item.revenue)} total revenue</small>
          </article>
        ))}
      </div>
    </figure>
  );
}
