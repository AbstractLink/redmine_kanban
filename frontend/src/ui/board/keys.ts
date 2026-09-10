import type { BoardData, Issue } from '../types';
import { isCustomFieldLaneType } from '../useKanbanPreferences';

export function buildSubtaskKey(issueId: number, subtaskId: number): string {
  return `${issueId}:${subtaskId}`;
}

export function parseSubtaskKey(key: string): { issueId: number; subtaskId: number } {
  const [issueId, subtaskId] = key.split(':').map(Number);
  return { issueId, subtaskId };
}

export function parseCellKey(key: string, data: BoardData): [number, string | number] {
  const [status, lane] = key.split(':');
  const statusId = Number(status);
  if (data.meta.lane_type === 'none') return [statusId, 'none'];
  if (lane === 'unassigned') return [statusId, 'unassigned'];
  if (lane === 'no_priority') return [statusId, 'no_priority'];
  if (lane === 'no_category') return [statusId, 'no_category'];
  if (lane === 'no_cf_value') return [statusId, 'no_cf_value'];
  if (lane?.startsWith('cfv_')) return [statusId, lane];
  const parsedLane = Number(lane);
  return [statusId, Number.isFinite(parsedLane) ? parsedLane : lane];
}

export function resolveBoardLaneId(data: BoardData, issue: Issue): string | number {
  if (data.meta.lane_type === 'assignee') return issue.assigned_to_id ?? 'unassigned';
  if (data.meta.lane_type === 'priority') return issue.priority_id ?? 'no_priority';
  if (data.meta.lane_type === 'category') return issue.category_id ?? 'no_category';
  if (isCustomFieldLaneType(data.meta.lane_type)) {
    // El id de carril es un indice (cfv_N) y no el valor: las claves de celda
    // son `estado:carril` y se parten por ':', asi que un valor que contuviese
    // dos puntos partiria la celda por la mitad.
    const value = issue.custom_field_values?.[data.meta.lane_type] ?? null;
    if (value === null) return 'no_cf_value';
    const lane = (data.lanes ?? []).find((it) => it.custom_field_value === value);
    return lane ? lane.id : 'no_cf_value';
  }
  return 'none';
}

export function laneIdToAssignee(
  data: BoardData,
  laneId: string | number,
  fallback: number | null,
): number | null {
  if (data.meta.lane_type !== 'assignee') return fallback;
  if (laneId === 'unassigned') return null;
  const parsed = Number(laneId);
  return Number.isFinite(parsed) ? parsed : null;
}

export function laneIdToPriority(
  data: BoardData,
  laneId: string | number,
  fallback: number | null,
): number | null | undefined {
  if (data.meta.lane_type !== 'priority') return fallback;
  if (laneId === 'no_priority') return null;
  const parsed = Number(laneId);
  return Number.isFinite(parsed) ? parsed : null;
}

export function laneIdToCategory(
  data: BoardData,
  laneId: string | number,
  fallback: number | null,
): number | null | undefined {
  if (data.meta.lane_type !== 'category') return fallback;
  if (laneId === 'no_category') return null;
  const parsed = Number(laneId);
  return Number.isFinite(parsed) ? parsed : null;
}
