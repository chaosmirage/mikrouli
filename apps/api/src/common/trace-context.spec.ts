import { trace } from '@opentelemetry/api';
import { formatLogWithTrace, getTraceContext, withTraceFields } from './trace-context';

const MOCK_TRACE_ID = 'aaaa1111bbbb2222cccc3333dddd4444';
const MOCK_SPAN_ID = 'eeee5555ffff6666';

interface FakeSpan {
  spanContext: () => { traceId: string; spanId: string };
}

function fakeSpan(traceId: string, spanId: string): FakeSpan {
  return { spanContext: () => ({ traceId, spanId }) };
}

describe('trace-context', () => {
  let activeSpan: FakeSpan | undefined;

  beforeEach(() => {
    activeSpan = undefined;
    jest
      .spyOn(trace, 'getActiveSpan')
      .mockImplementation(() => activeSpan as unknown as ReturnType<typeof trace.getActiveSpan>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getTraceContext returns null when no active span', () => {
    expect(getTraceContext()).toBeNull();
  });

  it('getTraceContext returns null when span has empty traceId', () => {
    activeSpan = fakeSpan('', '');
    expect(getTraceContext()).toBeNull();
  });

  it('getTraceContext returns ids from active span', () => {
    activeSpan = fakeSpan(MOCK_TRACE_ID, MOCK_SPAN_ID);
    expect(getTraceContext()).toEqual({ traceId: MOCK_TRACE_ID, spanId: MOCK_SPAN_ID });
  });

  it('withTraceFields merges trace ids into payload when span active', () => {
    activeSpan = fakeSpan(MOCK_TRACE_ID, MOCK_SPAN_ID);
    expect(withTraceFields({ requestId: 'r1' })).toEqual({
      traceId: MOCK_TRACE_ID,
      spanId: MOCK_SPAN_ID,
      requestId: 'r1',
    });
  });

  it('withTraceFields returns payload unchanged when no active span', () => {
    expect(withTraceFields({ requestId: 'r1' })).toEqual({ requestId: 'r1' });
  });

  it('formatLogWithTrace emits parseable JSON with traceId + spanId fields', () => {
    activeSpan = fakeSpan(MOCK_TRACE_ID, MOCK_SPAN_ID);
    const line = formatLogWithTrace('info', 'hello', { foo: 'bar' });
    expect(JSON.parse(line)).toEqual({
      level: 'info',
      message: 'hello',
      traceId: MOCK_TRACE_ID,
      spanId: MOCK_SPAN_ID,
      foo: 'bar',
    });
  });

  it('formatLogWithTrace omits trace fields when no active span', () => {
    const line = formatLogWithTrace('warn', 'detached');
    expect(JSON.parse(line)).toEqual({ level: 'warn', message: 'detached' });
  });
});
