import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../auth/current-user.decorator';
import { CAPABILITY_KEY } from './capability.decorator';
import { Capability, PolicyService } from './policy.service';

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly policy: PolicyService) {}

  async canActivate(context: ExecutionContext) {
    const capability = this.reflector.getAllAndOverride<Capability>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!capability) return true;
    const request = context.switchToHttp().getRequest<{ user?: AuthUser; params?: { id?: string } }>();
    if (!request.user) return false;
    const id = request.params?.id;
    await this.policy.assert(request.user.userId, capability, id && /^\d+$/.test(id) ? { topicId: BigInt(id) } : {});
    return true;
  }
}
