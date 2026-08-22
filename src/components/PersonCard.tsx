import { Mail } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import type { Person } from "@/lib/pairs";

// 個人頁用的「對方」卡片。信箱只出現在這裡（總表不放），因為配對到的雙方本來就該聯絡得上。
export function PersonCard({ person }: { person: Person }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-3xl font-extrabold tracking-tight">
          {person.name}
        </span>
        <Badge className="bg-tone-green-badge">{person.grade}</Badge>
      </div>
      <a
        href={`mailto:${person.email}`}
        className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground underline decoration-2 underline-offset-4 hover:text-foreground"
      >
        <Mail className="size-4 shrink-0" aria-hidden />
        {person.email}
      </a>
    </Card>
  );
}
