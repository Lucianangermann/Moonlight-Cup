// Participant names are stored as "Nachname, Vorname" (same convention as
// the server). Display always flips them to "Vorname Nachname" — this was
// hand-rolled in ~10 places across the screens before living here.
export const formatDisplayName = (name) => {
  const parts = (name ?? '').split(',');
  return parts.length > 1
    ? `${parts[1].trim()} ${parts[0].trim()}`
    : (name ?? '').trim();
};

// Common list-row variant: display name plus the league tag.
export const formatNameWithLeague = (participant) => {
  if (!participant) return '?';
  const display = formatDisplayName(participant.name);
  return participant.league ? `${display} [${participant.league}]` : display;
};
