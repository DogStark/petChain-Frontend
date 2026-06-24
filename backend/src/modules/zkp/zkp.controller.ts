import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ZkpService } from './zkp.service';
import { GenerateProofDto } from './dto/generate-proof.dto';
import { VerifyProofDto } from './dto/verify-proof.dto';

@Controller('zkp')
export class ZkpController {
  constructor(private readonly zkpService: ZkpService) {}

  /** POST /zkp/generate — generate a ZK proof for a vaccination */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  generate(@Body() dto: GenerateProofDto) {
    return this.zkpService.generateProof(dto);
  }

  /** POST /zkp/verify — verify a proof without exposing private data */
  @Post('verify')
  verify(@Body() dto: VerifyProofDto) {
    return this.zkpService.verifyProof(dto);
  }

  /** GET /zkp/pet/:petId — list proofs for a pet */
  @Get('pet/:petId')
  getForPet(@Param('petId') petId: string) {
    return this.zkpService.getProofsForPet(petId);
  }

  /** DELETE /zkp/:proofId — revoke a proof */
  @Delete(':proofId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Param('proofId') proofId: string) {
    return this.zkpService.revokeProof(proofId);
  }
}
