export function isFailedToolStatus(status: string) {
  return /(fail|error|cancel(?:led)?|abort|timeout|timed[_ -]?out)/.test(status);
}

export function isCompletedToolStatus(status: string) {
  return /(complete|completed|success|done|finish(?:ed)?|succeed(?:ed)?)/.test(
    status,
  );
}

export function isPendingToolStatus(status: string) {
  return /(pending|running|processing|started|in[_ -]?progress|inprogress|queued)/.test(
    status,
  );
}

export function shouldFinalizeToolStatus(status: string | null | undefined) {
  const normalizedStatus = (status ?? "").toLowerCase();
  if (
    isFailedToolStatus(normalizedStatus) ||
    isCompletedToolStatus(normalizedStatus)
  ) {
    return false;
  }
  return !normalizedStatus || isPendingToolStatus(normalizedStatus);
}
