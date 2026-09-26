import type { Hearing, HearingConflict } from "@/lib/types";

const MINUTE = 60_000;

export function findHearingConflicts(hearings: Hearing[], travelMinutes = 30): HearingConflict[] {
  const eligible = hearings.filter((hearing) =>
    hearing.status === "confirmed" || hearing.status === "proposed",
  );
  const conflicts: HearingConflict[] = [];

  for (let index = 0; index < eligible.length; index += 1) {
    for (let next = index + 1; next < eligible.length; next += 1) {
      const first = eligible[index];
      const second = eligible[next];
      if (first.advocate.id !== second.advocate.id) continue;

      const firstStart = new Date(first.startsAt).getTime();
      const firstEnd = new Date(first.endsAt).getTime();
      const secondStart = new Date(second.startsAt).getTime();
      const secondEnd = new Date(second.endsAt).getTime();
      const overlap = Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart);
      const gap = Math.max(firstStart, secondStart) - Math.min(firstEnd, secondEnd);
      const differentForum = first.forum !== second.forum || first.courtRoom !== second.courtRoom;

      if (overlap > 0 || (differentForum && gap >= 0 && gap < travelMinutes * MINUTE)) {
        conflicts.push({
          first,
          second,
          overlapMinutes: Math.max(0, Math.ceil(overlap / MINUTE)),
          travelMinutes,
        });
      }
    }
  }

  return conflicts;
}

export { formatDate, formatTime } from "@/lib/format";
