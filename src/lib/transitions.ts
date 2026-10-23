import { withActor } from "@/lib/db";
import type { Workspace } from "@/lib/workspace";

export function isTransitionEnabled() {
  return process.env.BNS_TRANSITION_ENABLED === "true";
}

const date = (value: string | Date | null) => value instanceof Date ? value.toISOString().slice(0, 10) : value;

export interface TransitionMapping {
  id: string; relation: string; mappingNote: string; sourceState: string; reviewedAt: string | null;
  legacy: { id: string; code: string; section: string; heading: string; text: string | null; effectiveFrom: string | null; effectiveUntil: string | null; sourceEdition: string; sourceState: string };
  current: { id: string; code: string; section: string; heading: string; text: string | null; effectiveFrom: string | null; effectiveUntil: string | null; sourceEdition: string; sourceState: string } | null;
  source: { name: string; rightsBasis: string; rightsReference: string; isFixture: boolean };
}

type MappingRow = {
  id: string; relation: string; mapping_note: string; source_state: string; reviewed_at: string | Date | null;
  legacy_id: string; legacy_code: string; legacy_section: string; legacy_heading: string; legacy_text: string | null; legacy_from: string | Date | null; legacy_until: string | Date | null; legacy_edition: string; legacy_state: string;
  current_id: string | null; current_code: string | null; current_section: string | null; current_heading: string | null; current_text: string | null; current_from: string | Date | null; current_until: string | Date | null; current_edition: string | null; current_state: string | null;
  source_name: string; rights_basis: string; rights_reference: string; is_fixture: boolean;
};

export async function listTransitionMappings(workspace: Workspace) {
  const result = await withActor(workspace.userId, (client) => client.query<MappingRow>(
    `select m.id,m.relation,m.mapping_note,m.source_state,m.reviewed_at,
       old.id legacy_id,old.code legacy_code,old.section_number legacy_section,old.heading legacy_heading,old.operative_text legacy_text,old.effective_from legacy_from,old.effective_until legacy_until,old.source_edition legacy_edition,old.source_state legacy_state,
       new.id current_id,new.code current_code,new.section_number current_section,new.heading current_heading,new.operative_text current_text,new.effective_from current_from,new.effective_until current_until,new.source_edition current_edition,new.source_state current_state,
       s.name source_name,s.rights_basis,s.rights_reference,s.is_fixture
     from transition_mappings m
     join transition_provisions old on old.id=m.legacy_provision_id
     left join transition_provisions new on new.id=m.current_provision_id
     join research_sources s on s.id=old.source_id
     where s.enabled order by old.code,old.section_number`,
  ));
  return result.rows.map((row): TransitionMapping => ({
    id: row.id, relation: row.relation, mappingNote: row.mapping_note, sourceState: row.source_state, reviewedAt: date(row.reviewed_at),
    legacy: { id: row.legacy_id, code: row.legacy_code, section: row.legacy_section, heading: row.legacy_heading, text: row.legacy_text, effectiveFrom: date(row.legacy_from), effectiveUntil: date(row.legacy_until), sourceEdition: row.legacy_edition, sourceState: row.legacy_state },
    current: row.current_id ? { id: row.current_id, code: row.current_code!, section: row.current_section!, heading: row.current_heading!, text: row.current_text, effectiveFrom: date(row.current_from), effectiveUntil: date(row.current_until), sourceEdition: row.current_edition!, sourceState: row.current_state! } : null,
    source: { name: row.source_name, rightsBasis: row.rights_basis, rightsReference: row.rights_reference, isFixture: row.is_fixture },
  }));
}

export function transitionReviewPrompt(input: { offenceDate?: string; firDate?: string; proceedingDate?: string }) {
  const beforeCutover = input.offenceDate ? input.offenceDate < "2024-07-01" : undefined;
  const messages = ["A lawyer must verify the official text, savings provisions, and procedural posture before relying on a transition mapping."];
  if (beforeCutover === true) messages.push("The recorded offence date is before 1 July 2024; verify substantive-law and savings questions against the facts and the official source.");
  if (beforeCutover === false) messages.push("The recorded offence date is on or after 1 July 2024; verify the applicable provision and commencement facts against the official source.");
  if (input.firDate || input.proceedingDate) messages.push("Recorded FIR/proceeding dates are context only; this worksheet does not determine the applicable law.");
  return { reviewState: "review_required" as const, messages };
}
