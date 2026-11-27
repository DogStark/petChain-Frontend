import React from "react";

/** Shared props for every skeleton primitive. */
export type SkeletonProps = {
  /** Extra classes merged onto the placeholder element. */
  className?: string;
};

/** Props for the shimmer line placeholder. */
export type SkeletonLineProps = SkeletonProps & {
  width?: string;
  height?: string;
};

/** Props for the circle avatar placeholder. */
export type SkeletonAvatarProps = SkeletonProps & {
  size?: number;
};

/** Shimmer line placeholder */
export function SkeletonLine({
  width = "100%",
  height = "1rem",
  className = "",
}: SkeletonLineProps) {
  return (
    <div
      className={`skeleton-shimmer rounded ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/** Card-shaped skeleton placeholder */
export function SkeletonCard({ className = "" }: SkeletonProps) {
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
}: SkeletonAvatarProps) {
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
    <div
      className="min-h-screen p-6 space-y-6 animate-pulse"
      aria-busy="true"
    >
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

/** Layout variants supported by {@link RouteLoadingState}. */
export type RouteLoadingVariant =
  | "dashboard"
  | "list"
  | "detail"
  | "form"
  | "table";

/** Props for the route-level loading state wrapper. */
export type RouteLoadingStateProps = {
  /** Layout the skeleton should mimic. Defaults to `"dashboard"`. */
  variant?: RouteLoadingVariant;
  /** Accessible label announced while the route loads. */
  label?: string;
  /** Number of repeated rows/cards rendered by the variant. */
  rows?: number;
  className?: string;
};

function DashboardSkeleton() {
  return (
    <>
      <div className="space-y-3">
        <SkeletonLine width="40%" height="2rem" />
        <SkeletonLine width="60%" height="1rem" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard className="mt-4" />
    </>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <SkeletonLine width="30%" height="2rem" />
        <SkeletonLine width="8rem" height="2.5rem" />
      </div>
      <ul className="space-y-4" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-4">
            <SkeletonAvatar size={48} />
            <div className="flex-1 space-y-2">
              <SkeletonLine width="45%" height="1rem" />
              <SkeletonLine width="70%" height="0.75rem" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function DetailSkeleton() {
  return (
    <>
      <div className="flex items-center gap-4">
        <SkeletonAvatar size={72} />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="35%" height="1.75rem" />
          <SkeletonLine width="25%" height="1rem" />
        </div>
      </div>
      <SkeletonCard />
      <div className="space-y-2">
        <SkeletonLine width="100%" height="1rem" />
        <SkeletonLine width="90%" height="1rem" />
        <SkeletonLine width="75%" height="1rem" />
      </div>
    </>
  );
}

function FormSkeleton({ rows }: { rows: number }) {
  return (
    <>
      <SkeletonLine width="30%" height="2rem" />
      <div className="space-y-6">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine width="20%" height="0.875rem" />
            <SkeletonLine width="100%" height="2.5rem" />
          </div>
        ))}
      </div>
      <SkeletonLine width="8rem" height="2.5rem" />
    </>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <>
      <SkeletonLine width="30%" height="2rem" />
      <div className="space-y-3">
        <SkeletonLine width="100%" height="2.5rem" />
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonLine key={i} width="100%" height="3rem" />
        ))}
      </div>
    </>
  );
}

/**
 * Route-level loading state. Renders a layout-matched skeleton inside an
 * `aria-busy` container with a polite live region so assistive technology is
 * told the route is loading.
 */
export function RouteLoadingState({
  variant = "dashboard",
  label = "Loading page content…",
  rows = 4,
  className = "",
}: RouteLoadingStateProps) {
  return (
    <div
      className={`min-h-screen p-6 space-y-6 ${className}`}
      aria-busy="true"
      data-testid="route-loading-state"
      data-variant={variant}
    >
      <span className="sr-only" role="status" aria-live="polite">
        {label}
      </span>
      <div aria-hidden="true" className="space-y-6">
      {variant === "dashboard" && <DashboardSkeleton />}
      {variant === "list" && <ListSkeleton rows={rows} />}
      {variant === "detail" && <DetailSkeleton />}
      {variant === "form" && <FormSkeleton rows={rows} />}
      {variant === "table" && <TableSkeleton rows={rows} />}
    </div>
  );
}
