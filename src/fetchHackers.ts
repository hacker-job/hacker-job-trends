/**
 * Build data/hackers.json — all GitHub sponsors of @timqian.
 *
 * Usage:  GITHUB_TOKEN=ghp_xxx npm run hackers
 *
 * The token must belong to @timqian (sponsor identities are only visible to the
 * sponsorable account). Requires the `read:user` scope.
 */
import fs from "fs";
import path from "path";

const SPONSORABLE = "timqian";
const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error("Set GITHUB_TOKEN (the token must belong to the sponsored account).");
  process.exit(1);
}

interface Hacker {
  login: string;
  name?: string;
  avatar?: string;
  url?: string;
  bio?: string;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data as T;
}

interface SponsorNode {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  bio?: string | null;
  description?: string | null;
}
interface SponsorsPage {
  user: {
    sponsors: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: SponsorNode[];
    };
  };
}

async function listSponsors(): Promise<SponsorNode[]> {
  const out: SponsorNode[] = [];
  let after: string | null = null;
  do {
    const data: SponsorsPage = await gql<SponsorsPage>(
      `query($login:String!, $after:String) {
        user(login:$login) {
          sponsors(first:100, after:$after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              __typename
              ... on User { login name avatarUrl url bio }
              ... on Organization { login name avatarUrl url description }
            }
          }
        }
      }`,
      { login: SPONSORABLE, after }
    );
    const page = data.user.sponsors;
    out.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return out;
}

async function main() {
  const sponsors = await listSponsors();
  console.log(`Found ${sponsors.length} sponsor(s) of @${SPONSORABLE}.`);

  const hackers: Hacker[] = sponsors.map((s) => ({
    login: s.login,
    name: s.name || undefined,
    avatar: s.avatarUrl,
    url: s.url,
    bio: (s.bio || s.description) || undefined,
  }));

  const out = path.resolve("site/data/hackers.json");
  fs.writeFileSync(out, JSON.stringify(hackers, null, 2) + "\n");
  console.log(`Wrote ${hackers.length} hacker(s) → ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
