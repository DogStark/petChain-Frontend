import { validate } from 'class-validator';
import {
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
} from './password-reset-security.dto';

describe('Password reset DTOs', () => {
  it('PasswordResetConfirmDto rejects weak password', async () => {
    const dto = new PasswordResetConfirmDto();
    Object.assign(dto, { token: 'x', newPassword: 'short' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('PasswordResetRequestDto accepts valid email', async () => {
    const dto = new PasswordResetRequestDto();
    dto.email = 'ok@example.com';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
