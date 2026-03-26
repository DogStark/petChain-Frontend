import { validate } from 'class-validator';
import { CreateBlockDto } from './create-block.dto';

describe('CreateBlockDto', () => {
  it('should pass validation with valid UUID', async () => {
    const dto = new CreateBlockDto();
    dto.blockedUserId = '123e4567-e89b-12d3-a456-426614174000';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation with invalid UUID', async () => {
    const dto = new CreateBlockDto();
    dto.blockedUserId = 'invalid-uuid';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('blockedUserId');
  });

  it('should fail validation with empty string', async () => {
    const dto = new CreateBlockDto();
    dto.blockedUserId = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('blockedUserId');
  });
});
