// Where the BMA canal feed comes from, in order of preference. BMA's own server sits behind Cloudflare, which answers
// Vercel's servers with HTTP 403 (seen in the production logs), so on the live site the first source never works.
// The fallback is flood69.peoplesparty.or.th, a political party's public re-serve of the same JSON: unofficial, no stated
// terms, and it lags (its cache header said STALE with a 15 minute TTL). It is therefore used ONLY when BMA itself fails,
// and the result always says which one answered, so the page never presents second-hand data as BMA's own.
export type BmaSourceId = "bma" | "mirror";
export const BMA_ENDPOINTS: { id: BmaSourceId; url: string }[] = [
  { id: "bma", url: "https://weather.bangkok.go.th/Klongmap/GetDataForUpdate" },
  { id: "mirror", url: "https://flood69.peoplesparty.or.th/api/klongmap" },
];

// First endpoint whose response `parse` accepts (returns non-null). A 200 that is a challenge page, an empty body or a
// different shape counts as a failure, same as an HTTP error. Throws with every reason if none works.
export async function firstWorking<T>(
  endpoints: { id: BmaSourceId; url: string }[],
  load: (url: string) => Promise<unknown>,
  parse: (json: unknown) => T | null,
): Promise<{ value: T; source: BmaSourceId }> {
  const why: string[] = [];
  for (const e of endpoints) {
    try {
      const value = parse(await load(e.url));
      if (value != null) return { value, source: e.id };
      why.push(`${e.id}: unusable response`);
    } catch (err) {
      why.push(`${e.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`BMA klongmap: no source worked (${why.join("; ")})`);
}
