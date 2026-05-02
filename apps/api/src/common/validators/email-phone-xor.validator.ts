import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'EmailPhoneXor', async: false })
export class EmailPhoneXorValidator implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const target = args.object as { email?: string; phone?: string };
    const hasEmail = typeof target.email === 'string' && target.email.trim().length > 0;
    const hasPhone = typeof target.phone === 'string' && target.phone.trim().length > 0;

    return (hasEmail || hasPhone) && !(hasEmail && hasPhone);
  }

  defaultMessage(): string {
    return 'Exactly one of email or phone must be provided';
  }
}
