import { Injectable, SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerRequest } from '@nestjs/throttler';
import { carriesApiCredential, type CredentialBearingRequest } from './credential-presence';

const CREDENTIALED_SKIP_METADATA = 'throttler:skip-for-credentialed-requests';

/**
 * Declares throttler names that must not be evaluated for a request carrying
 * a credential — the per-request counterpart of `@SkipThrottle`, which is
 * static and cannot distinguish actors. Takes the same `{ [name]: true }`
 * shape so a route reads as "this budget is skipped, but only for guests".
 */
export function SkipThrottleWhenCredentialed(
  skip: Record<string, boolean>,
): CustomDecorator<string> {
  return SetMetadata(
    CREDENTIALED_SKIP_METADATA,
    Object.keys(skip).filter((name) => skip[name]),
  );
}

/**
 * The global throttler guard the app boots: identical to `ThrottlerGuard`
 * except that names marked with `@SkipThrottleWhenCredentialed` are neither
 * counted against nor enforced on a credentialed request.
 *
 * A budget tightened to bound GUEST admission must not tax the registered
 * user behind the same route: the guard runs before authentication populates
 * `req.user`, so actor type is read from the raw request via
 * {@link carriesApiCredential}. A skipped name consumes no counter slot, so
 * credentialed traffic cannot exhaust the guest bound for anyone else.
 */
@Injectable()
export class CredentialedRequestThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    if (this.shedsForCredentialedRequest(props)) return true;
    return super.handleRequest(props);
  }

  private shedsForCredentialedRequest(props: ThrottlerRequest): boolean {
    const shedNames =
      this.reflector.getAllAndOverride<string[]>(CREDENTIALED_SKIP_METADATA, [
        props.context.getHandler(),
        props.context.getClass(),
      ]) ?? [];
    if (!shedNames.includes(props.throttler.name)) return false;
    const request = props.context.switchToHttp().getRequest<CredentialBearingRequest>();
    return carriesApiCredential(request);
  }
}
