import { Check, Circle } from "lucide-react";
import { activityProgress, type Activity } from "@/lib/activity";
import { cn } from "@/lib/utils";

export function ActivityProgress({ activity }: { activity: Activity }) {
  const progress = activityProgress(activity);
  return (
    <div>
      <h3 className="text-sm font-semibold">Progres {activity.kind}</h3>
      <ol className="mt-4 flex gap-2 sm:gap-4" aria-label={`Progres ${activity.id}`}>
        {progress.steps.map((step, index) => {
          const complete = index < progress.current || (progress.closed && index === progress.current);
          const current = index === progress.current;
          return (
            <li key={step} aria-current={current ? "step" : undefined} className="min-w-0 flex-1">
              <div className={cn("mb-3 h-1 rounded-full", index <= progress.current ? "bg-forest" : "bg-border")} />
              <span className={cn("flex size-6 items-center justify-center rounded-full border", complete ? "border-forest bg-forest/10 text-forest" : current ? "border-primary text-primary" : "text-muted-foreground")}>
                {complete ? <Check className="size-3.5" /> : current ? <Circle className="size-2 fill-current" /> : <span className="text-xs">{index + 1}</span>}
              </span>
              <span className={cn("mt-2 block break-words text-xs leading-relaxed", current ? "font-semibold text-foreground" : "text-muted-foreground")}>{step}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{progress.note}</p>
    </div>
  );
}