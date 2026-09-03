/**
 * Maps an area-of-interest name to its real satellite scene.
 *
 * Scenes are fetched by `scripts-local/fetch-imagery.py` from Esri World
 * Imagery for the exact coordinates referenced in the mock data.
 */

const SCENES: { match: RegExp; src: string }[] = [
  { match: /navi mumbai|mumbai|maharashtra/i, src: "/imagery/navi-mumbai.jpg" },
  { match: /sundarban|west bengal/i, src: "/imagery/sundarbans.jpg" },
  { match: /ludhiana|punjab/i, src: "/imagery/ludhiana.jpg" },
  { match: /jaisalmer|rajasthan/i, src: "/imagery/jaisalmer.jpg" },
  { match: /kerala|alleppey|puri|odisha|coast/i, src: "/imagery/kerala-coast.jpg" },
  { match: /delhi|ncr/i, src: "/imagery/delhi.jpg" },
];

const FALLBACK = "/imagery/navi-mumbai.jpg";

export function aoiImage(...hints: (string | undefined)[]): string {
  const hay = hints.filter(Boolean).join(" ");
  return SCENES.find((s) => s.match.test(hay))?.src ?? FALLBACK;
}
