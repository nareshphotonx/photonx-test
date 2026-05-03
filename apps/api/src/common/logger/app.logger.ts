import { ConsoleLogger, Injectable } from '@nestjs/common';
import { sanitizeForLog } from './log-sanitizer.util';

@Injectable()
export class AppLogger extends ConsoleLogger {
  log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(
      sanitizeForLog(message),
      ...optionalParams.map((entry) => sanitizeForLog(entry)),
    );
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(
      sanitizeForLog(message),
      ...optionalParams.map((entry) => sanitizeForLog(entry)),
    );
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(
      sanitizeForLog(message),
      ...optionalParams.map((entry) => sanitizeForLog(entry)),
    );
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(
      sanitizeForLog(message),
      ...optionalParams.map((entry) => sanitizeForLog(entry)),
    );
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(
      sanitizeForLog(message),
      ...optionalParams.map((entry) => sanitizeForLog(entry)),
    );
  }
}
