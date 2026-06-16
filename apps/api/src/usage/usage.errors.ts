import { HttpException, HttpStatus } from '@nestjs/common';

export class MonthlyLinkLimitExceededError extends HttpException {
  constructor() {
    super(
      {
        kind: 'problem',
        typeSlug: 'monthly-link-limit-exceeded',
        title: 'Monthly link limit reached',
        detail: 'You have reached your monthly short-link creation limit. Please try again next month or contact support to increase your allowance.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class MonthlyKeyLimitExceededError extends HttpException {
  constructor() {
    super(
      {
        kind: 'problem',
        typeSlug: 'monthly-key-limit-exceeded',
        title: 'Monthly API key limit reached',
        detail: 'You have reached your monthly API key creation limit. Please try again next month or contact support to increase your allowance.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
