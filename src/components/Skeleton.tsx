import React from "react";

/** Shimmer line placeholder */
export function SkeletonLine({
  width = "100%",
  height = "1rem",
  className = "",
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-shimmer rounded ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/** Card-shaped skeleton placeholder */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer rounded-2xl ${className}`}
      style={{ width: "100%", height: "12rem" }}
      aria-hidden="true"
    />
  );
}

/** Circle avatar skeleton */
export function SkeletonAvatar({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-shimmer rounded-full ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/** Full page skeleton for dynamically imported pages */
export function PageSkeleton() {
  return (
    <div className="min-h-screen p-6 space-y-6 animate-pulse">
      <SkeletonLine width="40%" height="2rem" />
      <SkeletonLine width="60%" height="1rem" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard className="mt-4" />
    </div>
  );
}
