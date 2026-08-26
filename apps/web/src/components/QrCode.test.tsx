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
    let capturedDownload: string | null;

    beforeEach(() => {
      capturedHref = null;
      capturedDownload = null;

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

      // Capture the href and the download filename of the <a download> the
      // handler clicks. The handler never appends the anchor to the DOM, so
      // this spy is the only seam both export formats can be observed through.
      const realCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = realCreateElement(tag);
        if (tag === 'a') {
          vi.spyOn(el, 'click').mockImplementation(() => {
            capturedHref = (el as HTMLAnchorElement).getAttribute('href');
            capturedDownload = (el as HTMLAnchorElement).getAttribute('download');
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
      expect(capturedDownload).toBe('qr-abc123.png');
    });

    it('downloads a data: SVG and never creates a blob: URL', () => {
      render(<QrCode value="https://example.com/abc123" />);

      const svgButton = screen.getByTestId('qr-download-svg');
      expect(svgButton).not.toBeDisabled();

      // The SVG export is synchronous: no Image, no canvas, so jsdom runs it
      // natively and only the anchor-click spy above is involved.
      fireEvent.click(svgButton);

      expect(createObjectURLSpy).not.toHaveBeenCalled();
      expect(capturedHref).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);

      // encodeURIComponent escapes commas, so the first comma separates the
      // URL scheme from the full percent-encoded payload.
      const encodedPayload = (capturedHref ?? '').split(',')[1] ?? '';
      const payload = decodeURIComponent(encodedPayload);

      // The standalone artifact is namespace-well-formed XML (serializer
      // namespace fixup; qrcode.react itself sets no xmlns).
      expect(payload.startsWith('<svg')).toBe(true);
      expect(payload).toContain('xmlns="http://www.w3.org/2000/svg"');

      expect(capturedDownload).toBe('qr-abc123.svg');
    });

    it('labels the PNG control "Download PNG" (en locale from the i18next test setup)', () => {
      render(<QrCode value="https://example.com/abc123" />);
      expect(screen.getByTestId('qr-download')).toHaveTextContent('Download PNG');
    });

    it('labels the SVG control "Download SVG" (en locale from the i18next test setup)', () => {
      render(<QrCode value="https://example.com/abc123" />);
      expect(screen.getByTestId('qr-download-svg')).toHaveTextContent('Download SVG');
    });
  });
});
