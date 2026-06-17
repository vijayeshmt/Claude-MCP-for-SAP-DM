export interface PaginatedResult<T = any> {
  value: T[];
  pagination: {
    fetched: number;
    skip: number;
    top: number;
    nextSkip: number;
    hasMore: boolean;
    instructions: string;
  };
}

/**
 * Formats a raw list of records into a paginated structure with metadata for the AI.
 * 
 * @param data The raw array of records returned from the client.
 * @param top The top value (page size) used in the query.
 * @param skip The skip value (offset) used in the query.
 */
export function formatPaginatedResult<T>(
  data: T[],
  top: number,
  skip: number
): PaginatedResult<T> {
  const records = Array.isArray(data) ? data : (data ? [data] : []);
  const fetched = records.length;
  // If the number of fetched records is equal to or greater than the page limit, there is more data.
  const hasMore = fetched >= top;
  const nextSkip = skip + fetched;

  let instructions = 'All records have been fetched. No further pages are available.';
  if (hasMore) {
    instructions = `More records are available. To load the next page, rerun the tool with top=${top} and skip=${nextSkip}.`;
  }

  return {
    value: records,
    pagination: {
      fetched,
      skip,
      top,
      nextSkip,
      hasMore,
      instructions,
    },
  };
}
