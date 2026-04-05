export default function SksSiteLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-40 rounded-full bg-[var(--accent-soft)]" />
      <section className="shell-panel h-52" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="shell-panel h-28" />
        ))}
      </section>
      <section className="shell-panel h-48" />
      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="shell-panel h-[560px]" />
        <div className="space-y-6">
          <div className="shell-panel h-64" />
          <div className="shell-panel h-52" />
        </div>
      </section>
    </div>
  );
}
