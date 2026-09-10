import { describe, expect, it } from 'vitest';
import type { BoardData, Issue } from '../types';
import { buildSubtaskKey, laneIdToAssignee, laneIdToCategory, laneIdToPriority, parseCellKey, parseSubtaskKey, resolveBoardLaneId } from './keys';

const baseData: BoardData = {
  ok: true,
  meta: {
    project_id: 1,
    current_user_id: 2,
    can_move: true,
    can_create: true,
    can_delete: true,
    lane_type: 'none',
    aging_warn_days: 3,
    aging_danger_days: 7,
    aging_exclude_closed: true,
  },
  columns: [],
  lanes: [],
  lists: { assignees: [], trackers: [], priorities: [], projects: [], viewable_projects: [], creatable_projects: [] },
  issues: [],
  labels: {},
};

const baseIssue: Issue = {
  id: 10,
  subject: 'Issue',
  status_id: 1,
  tracker_id: 1,
  description: '',
  assigned_to_id: null,
  urls: { issue: '/issues/10', issue_edit: '/issues/10/edit' },
};

describe('board keys helpers', () => {
  it('builds and parses subtask keys', () => {
    const key = buildSubtaskKey(12, 34);
    expect(key).toBe('12:34');
    expect(parseSubtaskKey(key)).toEqual({ issueId: 12, subtaskId: 34 });
  });

  it('parses cell keys for special lanes', () => {
    expect(parseCellKey('5:unassigned', { ...baseData, meta: { ...baseData.meta, lane_type: 'assignee' } })).toEqual([5, 'unassigned']);
    expect(parseCellKey('7:no_priority', { ...baseData, meta: { ...baseData.meta, lane_type: 'priority' } })).toEqual([7, 'no_priority']);
  });

  it('resolves lane ids and payload ids consistently', () => {
    expect(resolveBoardLaneId({ ...baseData, meta: { ...baseData.meta, lane_type: 'assignee' } }, { ...baseIssue, assigned_to_id: 9 })).toBe(9);
    expect(resolveBoardLaneId({ ...baseData, meta: { ...baseData.meta, lane_type: 'priority' } }, { ...baseIssue, priority_id: 4 })).toBe(4);
    expect(laneIdToAssignee({ ...baseData, meta: { ...baseData.meta, lane_type: 'assignee' } }, 'unassigned', 3)).toBeNull();
    expect(laneIdToPriority({ ...baseData, meta: { ...baseData.meta, lane_type: 'priority' } }, 'no_priority', 2)).toBeNull();
  });

  const categoryData: BoardData = { ...baseData, meta: { ...baseData.meta, lane_type: 'category' } };

  it('parses cell keys for the uncategorised lane', () => {
    expect(parseCellKey('7:no_category', categoryData)).toEqual([7, 'no_category']);
    expect(parseCellKey('7:12', categoryData)).toEqual([7, 12]);
  });

  it('resolves the lane id from the issue category', () => {
    expect(resolveBoardLaneId(categoryData, { ...baseIssue, category_id: 12 })).toBe(12);
    expect(resolveBoardLaneId(categoryData, { ...baseIssue, category_id: null })).toBe('no_category');
    expect(resolveBoardLaneId(categoryData, baseIssue)).toBe('no_category');
  });

  it('maps a category lane id back to a category id', () => {
    expect(laneIdToCategory(categoryData, 12, null)).toBe(12);
    expect(laneIdToCategory(categoryData, 'no_category', 5)).toBeNull();
  });

  it('resolves the lane id from a custom field value', () => {
    const cfData: BoardData = {
      ...baseData,
      meta: { ...baseData.meta, lane_type: 'cf_7' },
      lanes: [
        { id: 'cfv_0', name: 'Alpha', custom_field_value: 'alpha' },
        { id: 'cfv_1', name: 'Beta', custom_field_value: 'beta' },
        { id: 'no_cf_value', name: '(not set)', custom_field_value: null },
      ],
    };

    expect(resolveBoardLaneId(cfData, { ...baseIssue, custom_field_values: { cf_7: 'beta' } })).toBe('cfv_1');
    expect(resolveBoardLaneId(cfData, { ...baseIssue, custom_field_values: { cf_7: null } })).toBe('no_cf_value');
    expect(resolveBoardLaneId(cfData, baseIssue)).toBe('no_cf_value');
    // un valor que ya no esta entre los posibles cae al carril de sin valor
    expect(resolveBoardLaneId(cfData, { ...baseIssue, custom_field_values: { cf_7: 'gamma' } })).toBe('no_cf_value');
  });

  it('parses cell keys for custom field lanes', () => {
    const cfData: BoardData = { ...baseData, meta: { ...baseData.meta, lane_type: 'cf_7' } };
    expect(parseCellKey('5:cfv_2', cfData)).toEqual([5, 'cfv_2']);
    expect(parseCellKey('5:no_cf_value', cfData)).toEqual([5, 'no_cf_value']);
  });

  it('leaves the category untouched when the board is not laned by category', () => {
    const assigneeData: BoardData = { ...baseData, meta: { ...baseData.meta, lane_type: 'assignee' } };
    expect(laneIdToCategory(assigneeData, 'unassigned', 7)).toBe(7);
    expect(laneIdToPriority(categoryData, 12, 3)).toBe(3);
    expect(laneIdToAssignee(categoryData, 12, 4)).toBe(4);
  });
});
