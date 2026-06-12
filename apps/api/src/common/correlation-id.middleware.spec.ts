import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { getCorrelationId } from './correlation-id';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let mockRequest: { headers: Record<string, string | undefined> };
  let mockResponse: { setHeader: jest.Mock };
  let mockNext: jest.Mock;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
    mockRequest = { headers: {} };
    mockResponse = { setHeader: jest.fn() };
    mockNext = jest.fn();
  });

  it('generates a UUID v4 when no correlation header is provided', () => {
    middleware.use(
      mockRequest as never,
      mockResponse as never,
      mockNext,
    );

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Correlation-ID',
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
    );
  });

  it('uses the X-Correlation-ID header when provided', () => {
    mockRequest.headers['x-correlation-id'] = 'custom-id-123';

    middleware.use(
      mockRequest as never,
      mockResponse as never,
      mockNext,
    );

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Correlation-ID',
      'custom-id-123',
    );
  });

  it('falls back to X-Request-ID when X-Correlation-ID is absent', () => {
    mockRequest.headers['x-request-id'] = 'request-id-456';

    middleware.use(
      mockRequest as never,
      mockResponse as never,
      mockNext,
    );

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Correlation-ID',
      'request-id-456',
    );
  });

  it('prefers X-Correlation-ID over X-Request-ID when both are present', () => {
    mockRequest.headers['x-correlation-id'] = 'corr-id';
    mockRequest.headers['x-request-id'] = 'req-id';

    middleware.use(
      mockRequest as never,
      mockResponse as never,
      mockNext,
    );

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Correlation-ID',
      'corr-id',
    );
  });

  it('stores the correlation ID in AsyncLocalStorage and calls next inside the store', () => {
    middleware.use(
      mockRequest as never,
      mockResponse as never,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalled();
  });

  it('makes the correlation ID available via getCorrelationId() during next() execution', () => {
    let capturedId: string | undefined;

    mockNext.mockImplementation(() => {
      capturedId = getCorrelationId();
    });

    middleware.use(
      mockRequest as never,
      mockResponse as never,
      mockNext,
    );

    expect(capturedId).toBe(
      (mockResponse.setHeader.mock.calls[0] as string[])[1],
    );
  });

  it('clears the correlation ID after the request completes', () => {
    middleware.use(
      mockRequest as never,
      mockResponse as never,
      mockNext,
    );

    expect(getCorrelationId()).toBeUndefined();
  });
});
