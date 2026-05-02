import { Bookmark, Bug, CheckSquare, GitBranch, Zap, type LucideIcon } from 'lucide-react';

export type IssueType = 'TASK' | 'BUG' | 'STORY' | 'EPIC' | 'SUBTASK';

export const ISSUE_TYPES: Array<{
  id: IssueType;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}> = [
  { id: 'TASK', label: 'Task', icon: CheckSquare, color: '#0ea5e9', bg: '#e0f2fe' },
  { id: 'BUG', label: 'Bug', icon: Bug, color: '#dc2626', bg: '#fee2e2' },
  { id: 'STORY', label: 'Story', icon: Bookmark, color: '#16a34a', bg: '#dcfce7' },
  { id: 'EPIC', label: 'Epic', icon: Zap, color: '#7c3aed', bg: '#ede9fe' },
  { id: 'SUBTASK', label: 'Sub-task', icon: GitBranch, color: '#64748b', bg: '#f1f5f9' },
];

const TYPE_PREFIX = 'type:';

export function tagsFromIssueType(type: IssueType, otherTags: string[] = []): string[] {
  return [`${TYPE_PREFIX}${type}`, ...otherTags.filter((t) => !t.startsWith(TYPE_PREFIX))];
}

export function issueTypeFromTags(tags: unknown): IssueType {
  if (!Array.isArray(tags)) return 'TASK';
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    if (!tag.startsWith(TYPE_PREFIX)) continue;
    const rest = tag.slice(TYPE_PREFIX.length).toUpperCase();
    if (ISSUE_TYPES.some((t) => t.id === rest)) return rest as IssueType;
  }
  return 'TASK';
}

export function userTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string => typeof t === 'string' && !t.startsWith(TYPE_PREFIX));
}

export function getIssueType(id: IssueType) {
  return ISSUE_TYPES.find((t) => t.id === id) ?? ISSUE_TYPES[0];
}
