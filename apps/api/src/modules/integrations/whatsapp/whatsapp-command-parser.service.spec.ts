import { WhatsappCommandParserService } from './whatsapp-command-parser.service';

describe('WhatsappCommandParserService', () => {
  const service = new WhatsappCommandParserService();

  it('parses check-in command', () => {
    expect(service.parse('check in')).toEqual({ name: 'CHECK_IN' });
  });

  it('parses task log command', () => {
    expect(service.parse('log 2h T-101')).toEqual({
      name: 'TASK_LOG',
      hours: 2,
      taskKey: 'T-101',
    });
  });

  it('parses leave apply command', () => {
    expect(service.parse('apply leave tomorrow sick')).toEqual({
      name: 'LEAVE_APPLY',
      dateToken: 'tomorrow',
      reason: 'sick',
    });
  });

  it('parses leave reject command', () => {
    expect(service.parse('reject leave 123 incomplete proof')).toEqual({
      name: 'LEAVE_REJECT',
      requestCode: 123,
      reason: 'incomplete proof',
    });
  });

  it('returns UNKNOWN for unsupported command', () => {
    const parsed = service.parse('hello there');
    expect(parsed.name).toBe('UNKNOWN');
  });
});
