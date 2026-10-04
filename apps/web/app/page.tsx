export default function Home() {
  return (
    <main className="mx-auto flex max-w-content flex-col gap-6 px-4 py-16 md:px-8 xl:py-24">
      {/* The green logo disappears on the dark canvas, so dark mode swaps in the white version. */}
      <picture>
        <source srcSet="/brand/novera-logo-white.svg" media="(prefers-color-scheme: dark)" />
        <img src="/brand/novera-logo.svg" alt="" width={240} height={66} />
      </picture>
      <h1 className="text-display text-fg">Novera Mobility</h1>
    </main>
  );
}
