import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import EditLinkDialog from './EditLinkDialog';
import { theme } from '../theme';

const SLUG = 'abc123';
const CURRENT_URL = 'https://example.com/current';
const NEW_URL = 'https://example.com/new-destination';

function renderDialog(props?: Partial<React.ComponentProps<typeof EditLinkDialog>>) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <EditLinkDialog
        open
        slug={SLUG}
        currentUrl={CURRENT_URL}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />
    </ThemeProvider>,
  );
  return { onConfirm, onCancel };
}

describe('EditLinkDialog', () => {
  it('pre-fills the destination input with the current URL', () => {
    renderDialog();
    expect(screen.getByTestId('edit-url-input')).toHaveValue(CURRENT_URL);
  });

  it('submits the edited URL through onConfirm', () => {
    const { onConfirm } = renderDialog();
    fireEvent.change(screen.getByTestId('edit-url-input'), { target: { value: NEW_URL } });
    fireEvent.click(screen.getByTestId('edit-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(NEW_URL);
  });

  it('cancel closes without submitting', () => {
    const { onConfirm, onCancel } = renderDialog();
    fireEvent.click(screen.getByTestId('edit-cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables the confirm button while loading', () => {
    renderDialog({ loading: true });
    expect(screen.getByTestId('edit-confirm')).toBeDisabled();
  });

  it('renders a server-side validation error when provided', () => {
    renderDialog({ error: 'url must be a public http(s) URL' });
    expect(screen.getByText('url must be a public http(s) URL')).toBeInTheDocument();
  });
});
