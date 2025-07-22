
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Generic skeleton loader for better loading visuals.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-gray-100",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
