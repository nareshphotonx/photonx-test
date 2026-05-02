import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaskDependencyService {
  constructor(private readonly prisma: PrismaService) {}

  async wouldCreateCycle(
    tenantId: string,
    taskId: string,
    dependsOnTaskId: string,
  ): Promise<boolean> {
    if (taskId === dependsOnTaskId) {
      return true;
    }

    const visited = new Set<string>();
    const stack: string[] = [dependsOnTaskId];

    while (stack.length > 0) {
      const currentTaskId = stack.pop();

      if (!currentTaskId) {
        continue;
      }

      if (currentTaskId === taskId) {
        return true;
      }

      if (visited.has(currentTaskId)) {
        continue;
      }

      visited.add(currentTaskId);

      const rows = await this.prisma.taskDependency.findMany({
        where: {
          tenantId,
          taskId: currentTaskId,
        },
        select: {
          dependsOnTaskId: true,
        },
      });

      for (const row of rows) {
        if (!visited.has(row.dependsOnTaskId)) {
          stack.push(row.dependsOnTaskId);
        }
      }
    }

    return false;
  }
}
