const product = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#genome', label: 'Genome' },
  { href: '#healthgate', label: 'Healthgate™' },
  { href: '#verdict-engine', label: 'Verdict Engine' },
  { href: '#verdict-engine', label: 'PDF Reports' },
  { href: '#pricing', label: 'Pricing' },
];

const resources = [
  { href: '#faq', label: 'Documentation' },
  { href: '#faq', label: 'Changelog' },
  { href: '#faq', label: 'Blog' },
  { href: '#faq', label: 'Status' },
];

const company = [
  { href: '#final-cta', label: 'About' },
  { href: '#faq', label: 'Privacy' },
  { href: '#faq', label: 'Terms' },
  { href: '#final-cta', label: 'Contact' },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-canvas)] py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5 md:gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] bg-[var(--color-ink)] font-display text-[11px] font-bold text-white">
                LL
              </span>
              <span className="font-display text-[15px] font-bold tracking-tight">LaunchLense</span>
            </div>
            <p className="mt-3 max-w-xs text-[14px] text-[var(--color-muted)]">
              Kill bad startup ideas before they kill your time.
            </p>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--color-muted)]">
              Real spend. Real CTR. A verdict you can act on — in 48 hours.
            </p>
          </div>

          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Product
            </div>
            <ul className="mt-4 space-y-2.5">
              {product.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-[14px] text-[var(--color-ink)] transition-colors hover:text-[var(--color-muted)]">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Resources
            </div>
            <ul className="mt-4 space-y-2.5">
              {resources.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-[14px] text-[var(--color-ink)] transition-colors hover:text-[var(--color-muted)]">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Company
            </div>
            <ul className="mt-4 space-y-2.5">
              {company.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-[14px] text-[var(--color-ink)] transition-colors hover:text-[var(--color-muted)]">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[var(--color-border)] pt-8 sm:flex-row sm:items-center">
          <p className="text-[12px] text-[var(--color-muted)]">
            © 2026 LaunchLense. Built for founders who validate before they build.
          </p>
          <div className="flex gap-5 font-mono text-[12px]">
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
            >
              X
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
            >
              LinkedIn
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
