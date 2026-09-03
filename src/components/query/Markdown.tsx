/**
 * Minimal markdown renderer for assistant messages.
 *
 * The previous version only handled `**bold**`, so the `•` bullet lines the
 * engine emits rendered as literal text in a run-on paragraph. This handles
 * bold, bullet lists and paragraph breaks — everything `queryEngine` produces.
 */

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-text-primary">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function Markdown({ content }: { content: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="space-y-2 my-3">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-atmos" />
            <span><Inline text={b} /></span>
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[•\-]\s/.test(line)) {
      bullets.push(line.replace(/^[•\-]\s*/, ""));
      continue;
    }
    flush();
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-2 first:mt-0 last:mb-0">
        <Inline text={line} />
      </p>
    );
  }
  flush();

  return <div className="text-[0.9375rem] leading-[1.65] text-text-secondary">{blocks}</div>;
}
