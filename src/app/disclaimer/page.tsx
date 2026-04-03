import { StaticPageLayout } from "@/components/StaticPageLayout";
import { getMessages } from "@/lib/i18n";

const t = getMessages();

export default function DisclaimerPage() {
  const page = t.staticPages.disclaimer;

  return (
    <StaticPageLayout
      eyebrow={t.footer.disclaimer}
      title={page.title}
      description={page.description}
      sections={page.sections.map((section) => ({
        title: section.title,
        body: [...section.body],
      }))}
      aside={page.aside ? { title: page.aside.title, items: [...page.aside.items] } : undefined}
    />
  );
}
