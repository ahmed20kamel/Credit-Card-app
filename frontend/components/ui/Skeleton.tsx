'use client';

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-credit-card">
        <div className="skeleton-line skeleton-w-40 skeleton-h-sm" />
        <div className="skeleton-line skeleton-w-60 skeleton-h-md" style={{ marginTop: 'auto' }} />
        <div className="skeleton-row">
          <div className="skeleton-line skeleton-w-40 skeleton-h-sm" />
          <div className="skeleton-line skeleton-w-20 skeleton-h-sm" />
        </div>
      </div>
      <div className="skeleton-details">
        <div className="skeleton-line skeleton-w-80 skeleton-h-sm" />
        <div className="skeleton-line skeleton-w-60 skeleton-h-xs" />
        <div className="skeleton-row" style={{ marginTop: 'var(--space-4)' }}>
          <div className="skeleton-line skeleton-w-40 skeleton-h-md" />
          <div className="skeleton-line skeleton-w-30 skeleton-h-md" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton-line skeleton-w-full skeleton-h-sm" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-table-row">
          {[1, 2, 3, 4, 5].map(j => (
            <div key={j} className="skeleton-line skeleton-w-full skeleton-h-xs" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="skeleton-dashboard">
      <div className="skeleton-summary-grid">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton-summary-card">
            <div className="skeleton-line skeleton-w-40 skeleton-h-xs" />
            <div className="skeleton-line skeleton-w-60 skeleton-h-lg" />
          </div>
        ))}
      </div>
      <div className="skeleton-charts-grid">
        <div className="skeleton-chart" />
        <div className="skeleton-chart" />
      </div>
    </div>
  );
}
