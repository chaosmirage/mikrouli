import { useCallback, useRef } from 'react';
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
function downloadSvgAsPng(
  svgElement: SVGSVGElement,
  filename: string,
  size: number,
): void {
  if (typeof document === 'undefined' || !svgElement) return;

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

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
    const link = document.createElement('a');
    link.href = pngDataUrl;
    link.download = filename;
    link.click();
  };

  img.src = svgDataUrl;
}

/**
 * QrCode: A reusable, side-effect-free presentational component that renders
 * a scannable QR code for a URL plus a "Download PNG" control.
 *
 * Props:
 *   value: The full public short URL to encode
 *   size: Size in pixels (default 160)
 *
 * Renders:
 *   - Wrapper div with data-testid="qr-code" containing the SVG
 *   - Download button with data-testid="qr-download"
 *
 * The download mechanism rasterizes the SVG to a PNG via `data:` URLs only, so
 * it works under the app CSP (img-src 'self' data:); see downloadSvgAsPng.
 */
export default function QrCode({ value, size = 160 }: QrCodeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Stable callback (react-runtime-best-practices: useCallback for stable identity)
  const handleDownload = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const slug = extractSlugFromUrl(value);
    const filename = `qr-${slug}.png`;
    downloadSvgAsPng(svg, filename, size);
  }, [value, size]);

  return (
    <Stack spacing={2}>
      <Box sx={QR_CODE_WRAPPER_SX} data-testid="qr-code">
        <QRCodeSVG
          ref={svgRef}
          value={value}
          size={size}
          level="H"
          includeMargin={true}
        />
      </Box>
      <Box sx={QR_BUTTON_WRAPPER_SX}>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={handleDownload}
          data-testid="qr-download"
          size="small"
        >
          Download PNG
        </Button>
      </Box>
    </Stack>
  );
}
