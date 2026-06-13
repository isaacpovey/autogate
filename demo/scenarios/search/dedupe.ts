export type SearchMatch = {
  id: string;
  title: string;
  score: number;
};

/**
 * Inner loop of search ranking: collapse duplicate matches that the
 * fan-out retrievers can surface from overlapping shards before we hand
 * the ranked list to the scorer. Matches are keyed by their stable id.
 */
export const dedupeMatches = (matches: readonly SearchMatch[]): SearchMatch[] =>
  matches.reduce<SearchMatch[]>((unique, match) => {
    const seenIds = unique.map((existing) => existing.id);
    if (seenIds.indexOf(match.id) !== -1) {
      return unique;
    }
    return [...unique, match];
  }, []);
