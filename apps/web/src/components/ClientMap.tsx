import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";

const FireMap = lazy(() => import("./FireMap"));

export function ClientMap(props: ComponentProps<typeof FireMap>) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const fallback = <div className="h-full w-full animate-pulse bg-muted" />;
  if (!ready) return fallback;
  return (
    <Suspense fallback={fallback}>
      <FireMap {...props} />
    </Suspense>
  );
}
