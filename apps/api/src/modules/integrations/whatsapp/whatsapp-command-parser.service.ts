import { Injectable } from '@nestjs/common';

export type ParsedWhatsappCommand =
  | { name: 'CHECK_IN' }
  | { name: 'CHECK_OUT' }
  | { name: 'TASKS' }
  | { name: 'TASK_DETAIL'; taskKey: string }
  | { name: 'TASK_START'; taskKey: string }
  | { name: 'TASK_DONE'; taskKey: string }
  | { name: 'TASK_BLOCK'; taskKey: string; reason: string }
  | { name: 'TASK_LOG'; taskKey: string; hours: number }
  | { name: 'LEAVE_APPLY'; dateToken: string; reason: string }
  | { name: 'WFH_APPLY'; dateToken: string; reason: string }
  | { name: 'EXPENSE_APPLY'; amount: number; categoryToken: string; description: string }
  | { name: 'LEAVE_APPROVE'; requestCode: number }
  | { name: 'LEAVE_REJECT'; requestCode: number; reason: string }
  | { name: 'LEAVE_BALANCE' }
  | { name: 'MY_PERFORMANCE' }
  | { name: 'UNKNOWN'; raw: string };

@Injectable()
export class WhatsappCommandParserService {
  parse(commandText: string, taskKeyRegex = 'T-\\d+'): ParsedWhatsappCommand {
    const raw = commandText.trim();
    const text = raw.replace(/\s+/g, ' ');

    if (/^check in$/i.test(text)) {
      return { name: 'CHECK_IN' };
    }

    if (/^check out$/i.test(text)) {
      return { name: 'CHECK_OUT' };
    }

    if (/^tasks$/i.test(text)) {
      return { name: 'TASKS' };
    }

    if (/^leave balance$/i.test(text)) {
      return { name: 'LEAVE_BALANCE' };
    }

    if (/^my performance$/i.test(text)) {
      return { name: 'MY_PERFORMANCE' };
    }

    const taskRegex = new RegExp(taskKeyRegex, 'i');

    const taskDetail = text.match(/^task\s+(.+)$/i);
    if (taskDetail?.[1] && taskRegex.test(taskDetail[1])) {
      return { name: 'TASK_DETAIL', taskKey: taskDetail[1].toUpperCase() };
    }

    const taskStart = text.match(/^start\s+(.+)$/i);
    if (taskStart?.[1] && taskRegex.test(taskStart[1])) {
      return { name: 'TASK_START', taskKey: taskStart[1].toUpperCase() };
    }

    const taskDone = text.match(/^done\s+(.+)$/i);
    if (taskDone?.[1] && taskRegex.test(taskDone[1])) {
      return { name: 'TASK_DONE', taskKey: taskDone[1].toUpperCase() };
    }

    const taskBlock = text.match(/^block\s+(.+?)\s+(.+)$/i);
    if (taskBlock?.[1] && taskBlock[2] && taskRegex.test(taskBlock[1])) {
      return {
        name: 'TASK_BLOCK',
        taskKey: taskBlock[1].toUpperCase(),
        reason: taskBlock[2],
      };
    }

    const taskLog = text.match(/^log\s+([0-9]+(?:\.[0-9]+)?)h?\s+(.+)$/i);
    if (taskLog?.[1] && taskLog[2] && taskRegex.test(taskLog[2])) {
      return {
        name: 'TASK_LOG',
        hours: Number(taskLog[1]),
        taskKey: taskLog[2].toUpperCase(),
      };
    }

    const leaveApply = text.match(/^apply\s+leave\s+([^\s]+)\s+(.+)$/i);
    if (leaveApply?.[1] && leaveApply[2]) {
      return {
        name: 'LEAVE_APPLY',
        dateToken: leaveApply[1],
        reason: leaveApply[2],
      };
    }

    const wfhApply = text.match(/^apply\s+wfh\s+([^\s]+)\s+(.+)$/i);
    if (wfhApply?.[1] && wfhApply[2]) {
      return {
        name: 'WFH_APPLY',
        dateToken: wfhApply[1],
        reason: wfhApply[2],
      };
    }

    const expenseApply = text.match(/^expense\s+([0-9]+(?:\.[0-9]+)?)\s+([^\s]+)\s+(.+)$/i);
    if (expenseApply?.[1] && expenseApply[2] && expenseApply[3]) {
      return {
        name: 'EXPENSE_APPLY',
        amount: Number(expenseApply[1]),
        categoryToken: expenseApply[2],
        description: expenseApply[3],
      };
    }

    const leaveApprove = text.match(/^approve\s+leave\s+(\d+)$/i);
    if (leaveApprove?.[1]) {
      return {
        name: 'LEAVE_APPROVE',
        requestCode: Number(leaveApprove[1]),
      };
    }

    const leaveReject = text.match(/^reject\s+leave\s+(\d+)\s+(.+)$/i);
    if (leaveReject?.[1] && leaveReject[2]) {
      return {
        name: 'LEAVE_REJECT',
        requestCode: Number(leaveReject[1]),
        reason: leaveReject[2],
      };
    }

    return { name: 'UNKNOWN', raw };
  }
}
