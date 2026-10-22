"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  FileText,
  HeartPulse,
  PawPrint,
  Settings2,
  Stethoscope,
  Syringe,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";

interface DashboardCard {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEFAULT_CARDS: DashboardCard[] = [
  {
    id: "pets",
    title: "My Pets",
    description: "View and manage your registered pets.",
    href: "/pets",
    icon: PawPrint,
  },
  {
    id: "appointments",
    title: "Appointments",
    description: "Upcoming visits and care agenda.",
    href: "/appointments",
    icon: CalendarDays,
  },
  {
    id: "medical-records",
    title: "Medical Records",
    description: "Review and draft medical records.",
    href: "/medical-records",
    icon: FileText,
  },
  {
    id: "vaccinations",
    title: "Vaccinations",
    description: "Track vaccination history and due dates.",
    href: "/vaccinations",
    icon: Syringe,
  },
  {
    id: "health",
    title: "Health Overview",
    description: "Monitor health metrics across your pets.",
    href: "/health",
    icon: HeartPulse,
  },
  {
    id: "vets",
    title: "Find a Vet",
    description: "Locate trusted veterinary professionals.",
    href: "/vets",
    icon: Stethoscope,
  },
];

const STORAGE_PREFIX = "petchain.dashboard.layout";

interface SavedLayout {
  order: string[];
  hidden: string[];
}

function storageKey(accountId: string | undefined): string {
  return `${STORAGE_PREFIX}:${accountId ?? "anonymous"}`;
}

function loadLayout(accountId: string | undefined): SavedLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedLayout>;
    if (!Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) {
      return null;
    }
    return {
      order: parsed.order.filter((id): id is string => typeof id === "string"),
      hidden: parsed.hidden.filter((id): id is string => typeof id === "string"),
    };
  } catch {
    return null;
  }
}

function saveLayout(accountId: string | undefined, layout: SavedLayout): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(accountId), JSON.stringify(layout));
  } catch {
    // Storage may be unavailable (private mode, quota); layout stays in memory.
  }
}

/**
 * Reconcile a saved layout against the currently available cards.
 * Unknown saved ids are dropped and any card missing from the saved order
 * is appended in its default position, so a removed card restores the
 * default layout instead of leaving a gap.
 */
function reconcileLayout(
  saved: SavedLayout | null,
  available: DashboardCard[],
): { order: string[]; hidden: string[] } {
  const availableIds = new Set(available.map((card) => card.id));
  const defaultOrder = available.map((card) => card.id);

  if (!saved) {
    return { order: defaultOrder, hidden: [] };
  }

  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of saved.order) {
    if (availableIds.has(id) && !seen.has(id)) {
      order.push(id);
      seen.add(id);
    }
  }
  for (const id of defaultOrder) {
    if (!seen.has(id)) {
      order.push(id);
      seen.add(id);
    }
  }

  const hidden = saved.hidden.filter((id) => availableIds.has(id));
  return { order, hidden };
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [layout, setLayout] = useState<{ order: string[]; hidden: string[] }>({
    order: DEFAULT_CARDS.map((card) => card.id),
    hidden: [],
  });
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const accountId = user?.id;

  useEffect(() => {
    if (authLoading) return;
    const saved = loadLayout(accountId);
    setLayout(reconcileLayout(saved, DEFAULT_CARDS));
    setHydrated(true);
  }, [accountId, authLoading]);

  const persist = useCallback(
    (next: { order: string[]; hidden: string[] }) => {
      setLayout(next);
      saveLayout(accountId, next);
    },
    [accountId],
  );

  const moveCard = useCallback(
    (id: string, direction: -1 | 1) => {
      setLayout((current) => {
        const index = current.order.indexOf(id);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= current.order.length) {
          return current;
        }
        const order = [...current.order];
        [order[index], order[target]] = [order[target], order[index]];
        const next = { ...current, order };
        saveLayout(accountId, next);
        return next;
      });
    },
    [accountId],
  );

  const toggleCard = useCallback(
    (id: string) => {
      setLayout((current) => {
        const hidden = current.hidden.includes(id)
          ? current.hidden.filter((hiddenId) => hiddenId !== id)
          : [...current.hidden, id];
        const next = { ...current, hidden };
        saveLayout(accountId, next);
        return next;
      });
    },
    [accountId],
  );

  const resetLayout = useCallback(() => {
    const next = { order: DEFAULT_CARDS.map((card) => card.id), hidden: [] };
    persist(next);
    toast({ title: "Dashboard layout reset", description: "Default cards restored." });
  }, [persist, toast]);

  const cardsById = useMemo(() => {
    const map = new Map<string, DashboardCard>();
    for (const card of DEFAULT_CARDS) map.set(card.id, card);
    return map;
  }, []);

  const visibleCards = useMemo(
    () =>
      layout.order
        .filter((id) => !layout.hidden.includes(id))
        .map((id) => cardsById.get(id))
        .filter((card): card is DashboardCard => Boolean(card)),
    [layout, cardsById],
  );

  if (authLoading || !hydrated) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {user?.name ? `Welcome back, ${user.name}.` : "Welcome back."}
          </p>
        </div>
        <div className="flex gap-2">
          {editing && (
            <Button variant="outline" onClick={resetLayout}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reset layout
            </Button>
          )}
          <Button
            variant={editing ? "default" : "outline"}
            onClick={() => setEditing((value) => !value)}
            aria-pressed={editing}
          >
            <Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {editing ? "Done" : "Edit layout"}
          </Button>
        </div>
      </div>

      {editing && (
        <section
          aria-label="Customize dashboard cards"
          className="rounded-lg border bg-muted/30 p-4"
        >
          <h2 className="mb-3 text-sm font-medium">Choose cards and order</h2>
          <ul className="space-y-2">
            {layout.order.map((id, index) => {
              const card = cardsById.get(id);
              if (!card) return null;
              const Icon = card.icon;
              const isHidden = layout.hidden.includes(id);
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {card.title}
                    {isHidden && (
                      <span className="text-xs text-muted-foreground">(hidden)</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveCard(id, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${card.title} up`}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveCard(id, 1)}
                      disabled={index === layout.order.length - 1}
                      aria-label={`Move ${card.title} down`}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleCard(id)}
                      aria-pressed={!isHidden}
                      aria-label={
                        isHidden ? `Show ${card.title}` : `Hide ${card.title}`
                      }
                    >
                      {isHidden ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {visibleCards.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            All cards are hidden. Use “Edit layout” to show some cards again.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.id} href={card.href} className="block">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    <CardTitle className="text-base">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {card.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
