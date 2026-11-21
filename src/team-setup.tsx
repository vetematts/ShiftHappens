import { maxRoles, sampleTeam, shifts, templates, type Team } from "./round";

const storageKey = "shift-happens-team-v2";

const isTeam = (value: unknown): value is Team => {
  const team = value as Team;
  return Boolean(team) && typeof team.kind === "string"
    && Array.isArray(team.roles) && team.roles.length >= 1 && team.roles.length <= maxRoles
    && team.roles.every(role => typeof role.id === "string" && typeof role.label === "string" && typeof role.colour === "string")
    && Array.isArray(team.shiftNames) && team.shiftNames.length === 2 && (team.perDay === 1 || team.perDay === 2)
    && Array.isArray(team.needs) && team.needs.length === shifts.length
    && Array.isArray(team.people) && team.people.every(person => typeof person.name === "string" && typeof person.role === "string"
      && Array.isArray(person.days) && person.days.length === 7 && Number.isInteger(person.shifts));
};

/** Reads the saved team from this device, falling back to the sample café. */
export function loadTeam(): Team {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (isTeam(saved)) return saved;
  } catch {
    // Storage can be missing or hold something unreadable; use the sample team instead.
  }
  return copyTeam(sampleTeam);
}

export function saveTeam(team: Team) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(team));
  } catch {
    // The team still works for this visit if it can't be saved.
  }
}

export const copyTeam = (team: Team): Team => ({
  ...team,
  roles: team.roles.map(role => ({ ...role })),
  shiftNames: [...team.shiftNames],
  people: team.people.map(person => ({ ...person, days: [...person.days] })),
  needs: team.needs.map(need => ({ ...need })),
});

type Props = {
  team: Team;
  onChange: (team: Team) => void;
  /** Starts the chosen business's week. */
  onPlay: (team: Team) => void;
  onBack: () => void;
};

/** "Roster my team": pick a kind of business and its week starts straight away, ending with a real roster. */
export function TeamSetup({ team, onChange, onPlay, onBack }: Props) {
  return (
    <div className="setup">
      <header className="setup-head">
        <div>
          <p className="setup-kicker">Roster my team</p>
          <h2>What are you rostering?</h2>
        </div>
      </header>

      <div className="setup-body">
        <p className="setup-lede">Pick a business to play its week, then copy a real roster at the end.</p>
        <div className="setup-templates">
          {/* "Start from scratch" needs the editing steps, so it isn't offered */}
          {templates.filter(template => template.id !== "blank").map(template => (
            <button key={template.id} type="button" className="setup-template" data-on={team.kind === template.id}
              onClick={() => {
                const chosen = copyTeam(template.team);
                onChange(chosen);
                onPlay(chosen);
              }}>
              <span className="setup-icon" aria-hidden="true">{template.icon}</span>
              <strong>{template.label}</strong>
              <small>{template.blurb}</small>
            </button>
          ))}
        </div>
      </div>

      <footer className="setup-foot">
        <div className="setup-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>Menu</button>
        </div>
      </footer>
    </div>
  );
}

