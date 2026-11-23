import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('is a type="button" so it never submits a form by accident', () => {
    render(<Button>Check</Button>);
    expect(screen.getByRole('button', { name: 'Check' })).toHaveAttribute('type', 'button');
  });

  it('defaults to the secondary variant', () => {
    render(<Button>Hint</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'secondary');
  });

  it.each(['primary', 'secondary', 'ghost'] as const)('renders the %s variant', (variant) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', variant);
  });

  it('large size and full width for the Continue button', () => {
    render(
      <Button variant="primary" size="lg" block>
        繼續
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-size', 'lg');
    expect(btn).toHaveAttribute('data-block');
  });

  it('shows a small caption after the label, included in its name', () => {
    render(
      <Button variant="primary" caption="Continue">
        繼續
      </Button>,
    );
    expect(screen.getByRole('button', { name: '繼續 Continue' })).toBeInTheDocument();
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Check</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Check
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
