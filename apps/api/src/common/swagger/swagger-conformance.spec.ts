import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const HTTP_DECORATOR_PATTERN = /^\s*@(?:Get|Post|Patch|Delete|Put|Options|Head)\(/;

function listControllerFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listControllerFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith('.controller.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Swagger conformance', () => {
  const modulesRoot = join(__dirname, '../../modules');
  const mainFile = join(__dirname, '../../main.ts');
  const controllerFiles = listControllerFiles(modulesRoot);

  const mainSource = readFileSync(mainFile, 'utf8');
  const hasGlobalResponseDefaults =
    mainSource.includes('ensureSuccessResponse(') &&
    mainSource.includes("ensureErrorResponse(responses, '400'") &&
    mainSource.includes("ensureErrorResponse(responses, '500'");

  it('keeps global OpenAPI response defaults enabled', () => {
    expect(hasGlobalResponseDefaults).toBe(true);
  });

  it('enforces required swagger decorators on controllers and endpoints', () => {
    for (const file of controllerFiles) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split(/\r?\n/);

      expect(source).toContain('@ApiTags(');

      const controllerHasBearerAuth = source.includes('@ApiBearerAuth(');
      const isHealthController = file.endsWith('health.controller.ts');

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? '';
        if (!HTTP_DECORATOR_PATTERN.test(line)) {
          continue;
        }

        const methodDecorator = line.trim();
        const methodName = methodDecorator.slice(1, methodDecorator.indexOf('('));

        let nextRouteIndex = lines.length;
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
          if (HTTP_DECORATOR_PATTERN.test(lines[cursor] ?? '')) {
            nextRouteIndex = cursor;
            break;
          }
        }

        let blockStart = index;
        for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
          const candidate = (lines[cursor] ?? '').trim();
          if (candidate === '') {
            continue;
          }
          if (!candidate.startsWith('@')) {
            break;
          }
          blockStart = cursor;
        }

        const methodBlock = lines.slice(blockStart, nextRouteIndex).join('\n');
        const methodChunk = lines.slice(index, nextRouteIndex).join('\n');

        expect(methodBlock).toContain('@ApiOperation(');

        if (methodName === 'Post' || methodName === 'Patch') {
          expect(methodBlock).toContain('@ApiBody(');
        }

        if (methodChunk.includes('@Param(')) {
          expect(methodBlock).toContain('@ApiParam(');
        }

        if (methodChunk.includes('@Query(')) {
          expect(methodBlock).toContain('@ApiQuery(');
        }

        const isPublicEndpoint = methodBlock.includes('@Public(');
        if (!isPublicEndpoint && !isHealthController) {
          expect(
            controllerHasBearerAuth || methodBlock.includes('@ApiBearerAuth('),
          ).toBe(true);
        }

        const hasExplicitSuccessResponse =
          /@Api(?:Ok|Created|Accepted|NoContent)Response\(/.test(methodBlock);
        expect(hasExplicitSuccessResponse || hasGlobalResponseDefaults).toBe(true);

        const hasExplicitErrorResponse =
          /@Api(?:BadRequest|Unauthorized|Forbidden|NotFound|Conflict|TooManyRequests|InternalServerError)Response\(/.test(
            methodBlock,
          );

        // When explicit error decorators are omitted, global swagger defaults provide
        // standardized error examples for all status codes.
        expect(hasExplicitErrorResponse || hasGlobalResponseDefaults).toBe(true);
      }
    }
  });
});
