import { Module, Global } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Global() // Make global to avoid imports everywhere
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
