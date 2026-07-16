'use client';
// The spine of the workstation. One shared selection + hover + time window that every
// coordinated view reads and writes. This is what turns a set of charts into an instrument:
// select an entity once, and the map, network, timeline, inspector and evidence all respond.
import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react';
import type { Selection, SelectionKind, TimeWindow, FirRecord } from '@/lib/types';

interface WorkspaceState {
  selection: Selection;
  hovered: Selection;
  timeWindow: TimeWindow;
  records: FirRecord[];
  select: (kind: SelectionKind, id: string | null) => void;
  hover: (kind: SelectionKind, id: string | null) => void;
  setTimeWindow: (w: TimeWindow) => void;
  setRecords: (r: FirRecord[]) => void;
  /** Records left after the timeline brush — the filtered set every view should render. */
  visibleRecords: FirRecord[];
  isSelected: (kind: SelectionKind, id: string) => boolean;
  isActive: (kind: SelectionKind, id: string) => boolean;
  clear: () => void;
}

const NONE: Selection = { kind: null, id: null };
const Ctx = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(NONE);
  const [hovered, setHovered] = useState<Selection>(NONE);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(null);
  const [records, setRecordsRaw] = useState<FirRecord[]>([]);

  const select = useCallback((kind: SelectionKind, id: string | null) => {
    // Clicking the same entity again clears it — selection is a toggle, never a trap.
    setSelection((cur) => (cur.kind === kind && cur.id === id ? NONE : { kind, id }));
  }, []);
  const hover = useCallback((kind: SelectionKind, id: string | null) => setHovered({ kind, id }), []);
  const clear = useCallback(() => setSelection(NONE), []);

  // A new answer resets the temporal filter — the brush belongs to the answer it came from.
  const setRecords = useCallback((r: FirRecord[]) => { setRecordsRaw(r); setTimeWindow(null); setSelection(NONE); }, []);

  const visibleRecords = useMemo(() => {
    if (!timeWindow) return records;
    return records.filter((r) => {
      const t = new Date(r.occurred_at).getTime();
      return t >= timeWindow.from && t <= timeWindow.to;
    });
  }, [records, timeWindow]);

  const isSelected = useCallback(
    (kind: SelectionKind, id: string) => selection.kind === kind && selection.id === id,
    [selection],
  );
  // "Active" = selected OR hovered — what a view should visually emphasise.
  const isActive = useCallback(
    (kind: SelectionKind, id: string) =>
      (selection.kind === kind && selection.id === id) || (hovered.kind === kind && hovered.id === id),
    [selection, hovered],
  );

  const value = useMemo<WorkspaceState>(
    () => ({ selection, hovered, timeWindow, records, select, hover, setTimeWindow, setRecords, visibleRecords, isSelected, isActive, clear }),
    [selection, hovered, timeWindow, records, select, hover, setRecords, visibleRecords, isSelected, isActive, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return v;
}
