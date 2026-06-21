import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import QrCode from './QrCode';

describe('QrCode', () => {
  describe('rendering', () => {
    it('renders an SVG QR code with data-testid="qr-code"', () => {
      render(<QrCode value="https://example.com/abc123" />);

      const qrWrapper = screen.getByTestId('qr-code');
      expect(qrWrapper).toBeInTheDocument();
      expect(qrWrapper.querySelector('svg')).toBeInTheDocument();
    });

    it('renders download control with data-testid="qr-download"', () => {
      render(<QrCode value="https://example.com/abc123" />);
      expect(screen.getByTestId('qr-download')).toBeInTheDocument();
    });

    it('uses default size of 160 when not provided', () => {
      const { container } = render(<QrCode value="https://example.com/abc123" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '160');
      expect(svg).toHaveAttribute('height', '160');
    });

    it('uses custom size when provided', () => {
      const { container } = render(
        <QrCode value="https://example.com/abc123" size={256} />,
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '256');
      expect(svg).toHaveAttribute('height', '256');
    });
  });

  describe('download (CSP-safe: data: URLs only, never blob:)', () => {
    // jsdom does not implement URL.createObjectURL, so assign a spy directly
    // rather than wrapping a non-existent method.
    const createObjectURLSpy = vi.fn(() => 'blob:should-not-be-used');
    let capturedHref: string | null;

    beforeEach(() => {
      capturedHref = null;

      // The app CSP is `img-src 'self' data:` (no blob:). A blob: URL anywhere
      // in the download path is the regression we guard against, so fail loudly
      // if URL.createObjectURL is ever called.
      createObjectURLSpy.mockClear();
      URL.createObjectURL = createObjectURLSpy as unknown as typeof URL.createObjectURL;

      // jsdom has no canvas backend; stub the 2D context + PNG export.
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/png;base64,iVBORw0KGgoAAAANS',
      );

      // Image.onload never fires in jsdom; trigger it synchronously when src is set.
      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        width = 160;
        height = 160;
        private _src = '';
        set src(value: string) {
          this._src = value;
          this.onload?.();
        }
        get src(): string {
          return this._src;
        }
      }
      vi.stubGlobal('Image', MockImage);

      // Capture the href of the <a download> the handler clicks.
      const realCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = realCreateElement(tag);
        if (tag === 'a') {
          vi.spyOn(el, 'click').mockImplementation(() => {
            capturedHref = (el as HTMLAnchorElement).getAttribute('href');
          });
        }
        return el;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('download button is enabled', () => {
      render(<QrCode value="https://example.com/abc123" />);
      expect(screen.getByTestId('qr-download')).not.toBeDisabled();
    });

    it('downloads a data: PNG and never creates a blob: URL', () => {
      render(<QrCode value="https://example.com/abc123" />);

      fireEvent.click(screen.getByTestId('qr-download'));

      expect(createObjectURLSpy).not.toHaveBeenCalled();
      expect(capturedHref).toMatch(/^data:image\/png/);
    });
  });
});
