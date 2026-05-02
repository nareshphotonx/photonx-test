import { TaskDependencyService } from './task-dependency.service';

describe('TaskDependencyService', () => {
  const prisma = {
    taskDependency: {
      findMany: jest.fn(),
    },
  } as any;

  const service = new TaskDependencyService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when new dependency creates a cycle', async () => {
    prisma.taskDependency.findMany = jest.fn(({ where }) => {
      if (where.taskId === 'task_b') {
        return Promise.resolve([{ dependsOnTaskId: 'task_c' }]);
      }

      if (where.taskId === 'task_c') {
        return Promise.resolve([{ dependsOnTaskId: 'task_a' }]);
      }

      return Promise.resolve([]);
    });

    const result = await service.wouldCreateCycle('tenant_1', 'task_a', 'task_b');

    expect(result).toBe(true);
  });

  it('returns false when dependency graph remains acyclic', async () => {
    prisma.taskDependency.findMany = jest.fn(({ where }) => {
      if (where.taskId === 'task_b') {
        return Promise.resolve([{ dependsOnTaskId: 'task_c' }]);
      }

      if (where.taskId === 'task_c') {
        return Promise.resolve([]);
      }

      return Promise.resolve([]);
    });

    const result = await service.wouldCreateCycle('tenant_1', 'task_a', 'task_b');

    expect(result).toBe(false);
  });
});
