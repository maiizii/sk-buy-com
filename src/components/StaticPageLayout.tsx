type StaticPageSection = {
  title: string;
  body: string[];
};

type StaticPageAside = {
  title: string;
  items: string[];
};

type StaticPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: StaticPageSection[];
  aside?: StaticPageAside;
};

export function StaticPageLayout({
  eyebrow,
  title,
  description,
  sections,
  aside,
}: StaticPageLayoutProps) {
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="shell-panel overflow-hidden p-0">
        <div className="border-b border-[var(--border-color)] bg-[color:var(--accent-soft)]/60 px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
            {description}
          </p>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]"
              >
                <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--muted)] sm:text-[15px]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {aside ? (
            <aside className="h-fit rounded-2xl border border-[var(--border-color)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {aside.title}
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                {aside.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}
