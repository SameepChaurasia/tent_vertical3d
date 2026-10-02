/**
 * Skeleton loading state for the 3D viewer while models load.
 */
export function ViewerLoadingSkeleton() {
  return (
    <div className="viewer-loading-skeleton">
      <div className="viewer-loading-spinner">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="animate-spin"
        >
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
      </div>
      <p className="viewer-loading-text">Loading 3D Model…</p>
    </div>
  );
}
