import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

// Static sx objects hoisted to module scope (material-best-practices: no inline object literals)
const QR_CODE_WRAPPER_SX = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
} as const;

const QR_BUTTON_WRAPPER_SX = {
  display: 'flex',
  justifyContent: 'center',
  mt: 2,
} as const;

interface QrCodeProps {
  // The full public short URL to encode (e.g., "https://example.com/abc123")
  value: string;
  // Size of the QR code in pixels (default: 160)
  size?: number;
}

/**
 * Extracts a safe filename slug from a URL.
 * For URLs like "https://example.com/abc123", extracts "abc123".
 * Falls back to "qr-code" if extraction fails.
 * Pure function (no side effects).
 */
function extractSlugFromUrl(url: string): string {
  if (!url) return 'qr-code';

  try {
    const lastSegment = url.split('/').pop();
    if (!lastSegment) return 'qr-code';

    // Remove query params and fragments
    const slug = lastSegment.split(/[?#]/)[0];
    if (!slug) return 'qr-code';

    // Ensure filename is safe: alphanumeric, hyphens, underscores only
    const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');
    return safeSlug || 'qr-code';
  } catch {
    return 'qr-code';
  }
}

/**
 * Serializes an SVG element into a percent-encoded `data:` URL.
 *
 * This is the single URL-construction site for both export formats: every
 * href the export paths build is a `data:image/svg+xml` URL, never `blob:`.
 * The application Content-Security-Policy is `img-src 'self' data:`
 * (see nginx/nginx.conf), which blocks `blob:` images; staying on `data:`
 * keeps the exports working under that policy. `encodeURIComponent` escapes
 * commas, so `href.split(',')[1]` cannot be truncated by payload content.
 *
 * `XMLSerializer` namespace fixup supplies the `xmlns` declaration, so the
 * serialized markup is a standalone, namespace-well-formed SVG document.
 */
function serializeSvgToDataUrl(svgElement: SVGSVGElement): string {
  const svgString = new XMLSerializer().serializeToString(svgElement);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

/**
 * Triggers a file download through a transient anchor element.
 *
 * The anchor is created but never appended to the DOM; its `click()` hands
 * the href to the browser's download mechanism. Both export formats use this
 * one transport.
 */
function triggerDownload(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}

/**
 * Downloads the QR SVG element as a standalone SVG file.
 *
 * Synchronous by design: the SVG carries its own intrinsic geometry, so no
 * Image decode or canvas rasterization is needed. Serializes the exact
 * element rendered on the page and hands it to `triggerDownload` as a
 * `data:` URL.
 *
 * Guards for SSR (no document).
 */
function downloadSvg(svgElement: SVGSVGElement, filename: string): void {
  if (typeof document === 'undefined' || !svgElement) return;

  triggerDownload(serializeSvgToDataUrl(svgElement), filename);
}

/**
 * Converts the QR SVG element to a PNG and triggers a file download.
 * Rasterizes SVG -> data URL -> canvas -> PNG data URL -> download.
 *
 * Both the intermediate image source and the download href are `data:` URLs,
 * never `blob:`. The application Content-Security-Policy is
 * `img-src 'self' data:` (see nginx/nginx.conf), which blocks `blob:` images;
 * staying on `data:` keeps the download working under that policy.
 *
 * Guards for SSR (no document) and a missing 2D context.
 */
function downloadSvgAsPng(svgElement: SVGSVGElement, filename: string, size: number): void {
  if (typeof document === 'undefined' || !svgElement) return;

  const svgDataUrl = serializeSvgToDataUrl(svgElement);

  // Intrinsic SVG size (QRCodeSVG sets width/height to `size`); fall back to the
  // size prop when the DOM attribute is unavailable (e.g. jsdom).
  const width = svgElement.width?.baseVal?.value || size;
  const height = svgElement.height?.baseVal?.value || size;

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White background (QR codes scan reliably on white).
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const pngDataUrl = canvas.toDataURL('image/png');
    triggerDownload(pngDataUrl, filename);
  };

  img.src = svgDataUrl;
}

/**
 * QrCode: A reusable, side-effect-free presentational component that renders
 * a scannable QR code for a URL plus PNG and SVG export controls.
 *
 * Props:
 *   value: The full public short URL to encode
 *   size: Size in pixels (default 160)
 *
 * Renders:
 *   - Wrapper div with data-testid="qr-code" containing the SVG
 *   - Download PNG button with data-testid="qr-download"
 *   - Download SVG button with data-testid="qr-download-svg"
 *
 * Both download mechanisms use `data:` URLs only, so they work under the app
 * CSP (img-src 'self' data:); see serializeSvgToDataUrl and downloadSvgAsPng.
 */
export default function QrCode({ value, size = 160 }: QrCodeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { t } = useTranslation('common');

  // Stable callbacks (react-runtime-best-practices: useCallback for stable identity)
  const handleDownloadPng = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    downloadSvgAsPng(svg, `qr-${extractSlugFromUrl(value)}.png`, size);
  }, [value, size]);

  const handleDownloadSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    downloadSvg(svg, `qr-${extractSlugFromUrl(value)}.svg`);
  }, [value]);

  return (
    <Stack spacing={2}>
      <Box sx={QR_CODE_WRAPPER_SX} data-testid="qr-code">
        <QRCodeSVG ref={svgRef} value={value} size={size} level="H" includeMargin={true} />
      </Box>
      <Box sx={QR_BUTTON_WRAPPER_SX}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center">
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleDownloadPng}
            data-testid="qr-download"
            size="small"
          >
            {t('downloadPng')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleDownloadSvg}
            data-testid="qr-download-svg"
            size="small"
          >
            {t('downloadSvg')}
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
