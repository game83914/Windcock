import { SetMetadata } from '@nestjs/common';
import { Capability } from './policy.service';

export const CAPABILITY_KEY = 'capability';
export const RequiresCapability = (capability: Capability) => SetMetadata(CAPABILITY_KEY, capability);
