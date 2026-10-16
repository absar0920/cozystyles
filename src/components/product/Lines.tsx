/** Splits "a\nb" into lines joined with <br> (live `<br>` inside headings / icon texts / quotes). Server- and client-safe. */
export function Lines({ text }: { text: string }) {
  const parts = text.split('\n');
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {p}
        </span>
      ))}
    </>
  );
}
