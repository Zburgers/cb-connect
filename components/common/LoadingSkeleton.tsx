"use client";

interface LoadingSkeletonProps {
  className?: string;
}

export default function LoadingSkeleton({ className = "" }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse bg-muted/50 dark:bg-muted/30 rounded-lg ${className}`} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-slide-up">
      {/* Phase card skeleton */}
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center gap-4">
          <LoadingSkeleton className="w-16 h-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton className="h-6 w-32" />
            <LoadingSkeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <LoadingSkeleton className="h-24 rounded-2xl" />
          <LoadingSkeleton className="h-24 rounded-2xl" />
        </div>
      </div>

      {/* Pain logger skeleton */}
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <LoadingSkeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-2">
            <LoadingSkeleton className="h-5 w-32" />
            <LoadingSkeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="space-y-4">
          <LoadingSkeleton className="h-12 w-full" />
          <div className="flex gap-2">
            <LoadingSkeleton className="h-10 w-20 rounded-full" />
            <LoadingSkeleton className="h-10 w-20 rounded-full" />
            <LoadingSkeleton className="h-10 w-20 rounded-full" />
          </div>
          <LoadingSkeleton className="h-20 w-full rounded-2xl" />
          <LoadingSkeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>

      {/* Tips skeleton */}
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <LoadingSkeleton className="w-10 h-10 rounded-full" />
          <LoadingSkeleton className="h-5 w-40" />
        </div>
        <div className="space-y-3">
          <LoadingSkeleton className="h-16 w-full rounded-2xl" />
          <LoadingSkeleton className="h-16 w-full rounded-2xl" />
          <LoadingSkeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass-card rounded-3xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <LoadingSkeleton className="w-10 h-10 rounded-full" />
        <LoadingSkeleton className="h-5 w-32" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
