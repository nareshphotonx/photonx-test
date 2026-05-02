import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { type AiProviderToolDefinition } from './providers/ai-provider.interface';

export interface ToolMetadata extends AiProviderToolDefinition {
  permission: string;
}

@Injectable()
export class AiToolRegistryService {
  private readonly tools: ToolMetadata[] = [
    {
      name: 'get_user_leave_balance',
      description: 'Get leave balance for current user or a scoped user',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          year: { type: 'integer' },
        },
      },
    },
    {
      name: 'apply_leave',
      description: 'Create leave request',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: {
        type: 'object',
        required: ['leaveTypeId', 'startDate', 'endDate', 'reason'],
      },
    },
    {
      name: 'apply_wfh',
      description: 'Create WFH request',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: {
        type: 'object',
        required: ['requestDate', 'reason'],
      },
    },
    {
      name: 'list_my_tasks',
      description: 'List assigned tasks in scope',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: { type: 'object' },
    },
    {
      name: 'update_task_status',
      description: 'Change task status for a task by id',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: {
        type: 'object',
        required: ['taskId', 'statusId'],
      },
    },
    {
      name: 'log_task_hours',
      description: 'Log task hours as append-only time entry',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: {
        type: 'object',
        required: ['projectId', 'entryDate', 'hours'],
      },
    },
    {
      name: 'get_user_performance',
      description: 'Get 7-day (or custom days) user performance metrics',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: { type: 'object' },
    },
    {
      name: 'get_project_burn',
      description: 'Get project burn and threshold status',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: {
        type: 'object',
        required: ['projectId'],
      },
    },
    {
      name: 'list_pending_approvals',
      description: 'List pending approvals for actor scope',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: { type: 'object' },
    },
    {
      name: 'who_is_on_leave_today',
      description: 'List users on leave for a specific date',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: { type: 'object' },
    },
    {
      name: 'file_expense',
      description: 'File an expense request',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: {
        type: 'object',
        required: [
          'projectId',
          'categoryId',
          'amount',
          'currency',
          'expenseDate',
          'description',
        ],
      },
    },
    {
      name: 'check_in',
      description: 'Perform attendance check-in',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: { type: 'object' },
    },
    {
      name: 'check_out',
      description: 'Perform attendance check-out',
      permission: PERMISSIONS.AI_CHAT,
      inputSchema: { type: 'object' },
    },
  ];

  listTools(): ToolMetadata[] {
    return this.tools;
  }

  hasTool(toolName: string): boolean {
    return this.tools.some((entry) => entry.name === toolName);
  }
}
