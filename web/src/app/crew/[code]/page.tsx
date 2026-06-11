export default async function CrewPage(props: PageProps<"/crew/[code]">) {
  const { code } = await props.params;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        Crew code
      </p>
      <h1 className="font-mono text-4xl font-bold tracking-[0.2em]">{code}</h1>
      <p className="max-w-xs text-zinc-500 dark:text-zinc-400">
        The live crew screen lands in the next step, when the realtime server
        joins the party.
      </p>
    </main>
  );
}
