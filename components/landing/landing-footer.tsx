const product = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#genome', label: 'Genome' },
  { href: '#healthgate', label: 'Healthgate™' },
  { href: '#verdict-engine', label: 'Verdict Engine' },
];

const resources = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/data-deletion', label: 'Data deletion' },
];

const company = [
  { href: 'mailto:support@launchlense.app', label: 'Contact' },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-[rgba(0,0,0,0.07)] bg-[#ffffff] py-16 px-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4 md:gap-8">
          <div className="col-span-2">
            <div className="font-['Sora'] text-[15px] font-bold tracking-tight text-[#1a1a1a]">
              LaunchLense
            </div>
            <p className="font-['Sora'] mt-3 max-w-xs text-[14px] text-[#6b7280]">
              Kill bad startup ideas before they kill your time.
            </p>
            <p className="font-['Sora'] mt-3 max-w-sm text-[14px] leading-relaxed text-[#6b7280]">
              Real spend. Real CTR. A verdict you can act on — in 48 hours.
            </p>
          </div>

          <div>
            <div className="font-['DM_Mono'] text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">
              Product
            </div>
            <ul className="mt-4 space-y-2.5">
              {product.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="font-['Sora'] text-[14px] text-[#1a1a1a] transition-colors hover:text-[#6b7280]">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-['DM_Mono'] text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">
              Resources
            </div>
            <ul className="mt-4 space-y-2.5">
              {resources.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="font-['Sora'] text-[14px] text-[#1a1a1a] transition-colors hover:text-[#6b7280]">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-['DM_Mono'] text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">
              Company
            </div>
            <ul className="mt-4 space-y-2.5">
              {company.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="font-['Sora'] text-[14px] text-[#1a1a1a] transition-colors hover:text-[#6b7280]">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[rgba(0,0,0,0.07)] pt-8 sm:flex-row sm:items-center">
          <p className="font-['Sora'] text-[12px] text-[#6b7280]">
            © 2026 LaunchLense. Built for founders who validate before they build.
          </p>
          <div className="flex gap-5">
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-['Sora'] text-[12px] text-[#6b7280] transition-colors hover:text-[#1a1a1a]"
            >
              X
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-['Sora'] text-[12px] text-[#6b7280] transition-colors hover:text-[#1a1a1a]"
            >
              LinkedIn
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-['Sora'] text-[12px] text-[#6b7280] transition-colors hover:text-[#1a1a1a]"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
