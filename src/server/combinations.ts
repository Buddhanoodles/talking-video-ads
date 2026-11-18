/** Every hook x actor x language combination, in reading order. */
export function combinations(
  hooks: string[],
  actorIds: string[],
  languages: string[],
) {
  return hooks.flatMap((hook, hookIndex) =>
    actorIds.flatMap((actorId) =>
      languages.map((language) => ({ hook, hookIndex, actorId, language })),
    ),
  );
}
