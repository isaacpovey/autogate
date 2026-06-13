export type OwnerRepo = {
  owner: string;
  repo: string;
};

export const parseRepo = ({ repo }: { repo: string }): OwnerRepo => {
  const [owner, name] = repo.split('/');
  if (owner === undefined || owner === '' || name === undefined || name === '') {
    throw new Error(`vcs-github: expected repo as "owner/name", received "${repo}"`);
  }
  return { owner, repo: name };
};
