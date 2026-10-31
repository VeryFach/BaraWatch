import {
  type ComponentProps,
  lazy,
  Suspense,
  useEffect,
  useId,
  useState,
} from "react";

const FireMap = lazy(() => import("./FireMap"));

export function ClientMap(props: ComponentProps<typeof FireMap>) {
  const [ready, setReady] = useState(false);
  const mapKey = useId();
  useEffect(() => setReady(true), []);
  const fallback = <div className="h-full w-full animate-pulse bg-muted" />;
  if (!ready) return fallback;
  return (
    <Suspense fallback={fallback}>
      <FireMap key={mapKey} {...props} />
    </Suspense>
  );
}
