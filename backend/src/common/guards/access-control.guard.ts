import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PetsService } from '../../modules/pets/pets.service';

@Injectable()
export class AccessControlGuard implements CanActivate {
  constructor(private readonly petsService: PetsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const petId = request.params.petId || request.body.petId;

    // If no user or no petId, allow (will be handled by other guards/validation)
    if (!user || !petId) {
      return true;
    }

    // Verify the user owns the pet
    const isOwner = await this.petsService.verifyOwnership(petId, user.id);

    if (!isOwner) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
