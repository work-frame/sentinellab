import { render, screen } from '@testing-library/react';
import { FindingStatusBadge, ScanStatusBadge, SeverityBadge } from '@/components/badges';
import { EvidenceView } from '@/components/evidence-view';
import { EmptyState } from '@/components/states';
import { Pagination } from '@/components/ui';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('badges', () => {
  it('labels severity with text, not only color', () => {
    render(<SeverityBadge severity="CRITICAL" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('formats scan and finding statuses', () => {
    render(
      <>
        <ScanStatusBadge status="RUNNING" />
        <FindingStatusBadge status="FALSE_POSITIVE" />
      </>,
    );
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('False Positive')).toBeInTheDocument();
  });
});

describe('EvidenceView', () => {
  it('shows a hostile response body as text and never renders it', () => {
    const { container } = render(
      <EvidenceView
        evidence={{
          id: '1',
          summary: 'Matched <b>stack trace</b>',
          request: { method: 'GET', url: 'http://x/', headers: { 'user-agent': 'SentinelLab' } },
          response: { status: 500, headers: { 'content-type': ['text/html'] }, bodySnippet: '<img src=x onerror=alert(1)><script>alert(2)</script>', bodyTruncated: false },
        }}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText(/onerror=alert\(1\)/)).toBeInTheDocument();
  });
});

describe('EmptyState and Pagination', () => {
  it('renders an action link in empty states', () => {
    render(<EmptyState title="No targets yet" body="Add one." action={{ href: '/targets/new', label: 'Add target' }} />);
    expect(screen.getByRole('link', { name: 'Add target' })).toHaveAttribute('href', '/targets/new');
  });

  it('disables navigation at the edges', () => {
    render(<Pagination page={1} pageSize={20} total={45} onPage={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });
});
