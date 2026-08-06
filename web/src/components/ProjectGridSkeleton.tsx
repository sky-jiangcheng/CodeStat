// ProjectGridSkeleton renders placeholder cards while dashboard data loads.
export default function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="project-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="project-card skeleton-card">
          <div className="card-header">
            <div className="skeleton skeleton-text" style={{ width: '60%', height: 20 }} />
          </div>
          <div className="card-grid">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="card-stat">
                <div className="skeleton skeleton-text" style={{ width: 32, height: 10 }} />
                <div className="skeleton skeleton-text" style={{ width: 40, height: 16 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
