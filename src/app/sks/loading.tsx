export default function SksLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <section className="shell-panel h-44" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="shell-panel h-28" />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="shell-panel h-[360px]" />
        ))}
      </section>
    </div>
  );
}
