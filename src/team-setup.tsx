import { useState, type CSSProperties } from "react";
import {
  checkTeam, days, maxPerShift, maxRoles, roleColours, roleIn, sampleTeam, shiftLabel, shifts, templates,
  type Person, type Role, type Team,
} from "./round";

const storageKey = "shift-happens-team-v2";
const maxShifts = 10;

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

const steps = ["Business", "Roles & shifts", "Team", "Week"] as const;

type Props = {
  team: Team;
  onChange: (team: Team) => void;
  onPlay: () => void;
  onBack: () => void;
};

/** "Roster my team": pick a kind of business, set up roles, people and the week, then play it to get a real roster. */
export function TeamSetup({ team, onChange, onPlay, onBack }: Props) {
  const [step, setStep] = useState(0);
  const check = checkTeam(team);
  const named = team.people.filter(person => person.name.trim());
  const ready = check.needed > 0 && named.length > 0;
  const shiftsOf = (shift: number) => team.roles.reduce((sum, role) => sum + (team.needs[shift]?.[role.id] ?? 0), 0);

  const update = (change: Partial<Team>) => onChange({ ...team, ...change });
  const updatePerson = (index: number, change: Partial<Person>) =>
    update({ people: team.people.map((person, i) => (i === index ? { ...person, ...change } : person)) });
  const updateRole = (index: number, change: Partial<Role>) =>
    update({ roles: team.roles.map((role, i) => (i === index ? { ...role, ...change } : role)) });

  function addRole() {
    const used = new Set(team.roles.map(role => role.colour));
    const id = `role-${Date.now().toString(36)}`;
    update({ roles: [...team.roles, { id, label: "", colour: roleColours.find(colour => !used.has(colour)) ?? roleColours[0] }] });
  }

  function removeRole(index: number) {
    const gone = team.roles[index].id;
    const fallback = team.roles.find((_, i) => i !== index)!.id;
    update({
      roles: team.roles.filter((_, i) => i !== index),
      people: team.people.map(person => (person.role === gone ? { ...person, role: fallback } : person)),
      needs: team.needs.map(need => Object.fromEntries(Object.entries(need).filter(([id]) => id !== gone))),
    });
  }

  // Clicking a cell adds one more of that role, wrapping back to none
  function bump(shift: number, role: string, by: number) {
    const current = team.needs[shift]?.[role] ?? 0;
    const others = shiftsOf(shift) - current;
    const room = maxPerShift - others;
    let next = current + by;
    if (next > room || next > maxPerShift) next = 0;
    if (next < 0) next = Math.max(0, room);
    update({ needs: team.needs.map((need, i) => (i === shift ? { ...need, [role]: next } : need)) });
  }

  function fillRow(role: string, half: number, count: number) {
    update({
      needs: team.needs.map((need, shift) => {
        if ((shift < 7 ? 0 : 1) !== half || shift % 7 > 4) return need;
        const others = shiftsOf(shift) - (need[role] ?? 0);
        return { ...need, [role]: Math.max(0, Math.min(count, maxPerShift - others)) };
      }),
    });
  }

  return (
    <div className="setup">
      <header className="setup-head">
        <div>
          <p className="setup-kicker">Roster my team</p>
          <h2>{["What are you rostering?", "Roles and shifts", "Who’s on the team?", "What does the week need?"][step]}</h2>
        </div>
        <ol className="setup-steps" aria-label="Steps">
          {steps.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined} data-done={i < step}>
              <button type="button" onClick={() => setStep(i)}><b>{i + 1}</b> {label}</button>
            </li>
          ))}
        </ol>
      </header>

      <div className="setup-body">
        {step === 0 && (
          <>
            <p className="setup-lede">Pick the closest match and change anything you like. You’ll play your real week, then copy a real roster at the end.</p>
            <div className="setup-templates">
              {templates.map(template => (
                <button key={template.id} type="button" className="setup-template" data-on={team.kind === template.id}
                  onClick={() => {
                    onChange(copyTeam(template.team));
                    setStep(template.id === "blank" ? 1 : 2);
                  }}>
                  <span className="setup-icon" aria-hidden="true">{template.icon}</span>
                  <strong>{template.label}</strong>
                  <small>{template.blurb}</small>
                </button>
              ))}
            </div>
            {team.people.length > 0 && (
              <button type="button" className="setup-link" onClick={() => setStep(2)}>
                Keep editing my saved team ({team.people.length} people, {check.needed} places)
              </button>
            )}
          </>
        )}

        {step === 1 && (
          <div className="setup-columns">
            <section>
              <h3>Roles</h3>
              <p className="setup-help">The jobs people do. Up to {maxRoles}, each with its own colour.</p>
              <div className="setup-roles">
                {team.roles.map((role, i) => (
                  <div className="setup-role" key={role.id} style={{ "--role": role.colour } as CSSProperties}>
                    <button type="button" className="setup-swatch" aria-label={`Change ${role.label || "role"} colour`}
                      onClick={() => updateRole(i, { colour: roleColours[(roleColours.indexOf(role.colour) + 1) % roleColours.length] })} />
                    <input aria-label={`Role ${i + 1} name`} placeholder="Role name, e.g. Dentist" value={role.label} maxLength={14}
                      onChange={event => updateRole(i, { label: event.target.value })} />
                    {team.roles.length > 1 && (
                      <button type="button" className="setup-remove" onClick={() => removeRole(i)} aria-label={`Remove ${role.label || "this role"}`}>×</button>
                    )}
                  </div>
                ))}
              </div>
              {team.roles.length < maxRoles && <button type="button" className="setup-add" onClick={addRole}>+ Add role</button>}
            </section>
            <section>
              <h3>Shifts</h3>
              <p className="setup-help">Each day has two shifts. Name them however your business does.</p>
              <div className="setup-shift-names">
                {team.shiftNames.map((name, i) => (
                  <label key={i}>
                    <span>{i ? "Second shift" : "First shift"}</span>
                    <input value={name} maxLength={8} placeholder={i ? "PM" : "AM"}
                      onChange={event => update({ shiftNames: team.shiftNames.map((other, j) => (j === i ? event.target.value : other)) as [string, string] })} />
                  </label>
                ))}
              </div>
              <label className="setup-toggle">
                <input type="checkbox" checked={team.perDay === 2} onChange={event => update({ perDay: event.target.checked ? 2 : 1 })} />
                <span>People can work both shifts in a day</span>
              </label>
            </section>
          </div>
        )}

        {step === 2 && (
          <>
            <div className="setup-people">
              {team.people.map((person, index) => {
                const role = roleIn(team.roles, person.role);
                return (
                  <div className="setup-person" key={index} style={{ "--role": role.colour } as CSSProperties}>
                    <input aria-label="Name" placeholder="Name" value={person.name} maxLength={12}
                      onChange={event => updatePerson(index, { name: event.target.value })} />
                    <select aria-label={`${person.name || "Person"}’s role`} value={person.role}
                      onChange={event => updatePerson(index, { role: event.target.value })}>
                      {team.roles.map(entry => <option key={entry.id} value={entry.id}>{entry.label || "Unnamed role"}</option>)}
                    </select>
                    <span className="setup-days" role="group" aria-label={`Days ${person.name || "this person"} can work`}>
                      {days.map((day, i) => (
                        <button key={day} type="button" aria-pressed={person.days[i]} aria-label={day}
                          onClick={() => updatePerson(index, { days: person.days.map((on, d) => (d === i ? !on : on)) })}>{day[0]}</button>
                      ))}
                    </span>
                    <span className="setup-stepper" aria-label={`${person.name || "This person"} works up to ${person.shifts} shifts`}>
                      <button type="button" aria-label="Fewer shifts" onClick={() => updatePerson(index, { shifts: Math.max(1, person.shifts - 1) })}>−</button>
                      <b>{person.shifts}</b>
                      <button type="button" aria-label="More shifts" onClick={() => updatePerson(index, { shifts: Math.min(maxShifts, person.shifts + 1) })}>+</button>
                      <small>shifts</small>
                    </span>
                    <button type="button" className="setup-remove" onClick={() => update({ people: team.people.filter((_, i) => i !== index) })}
                      aria-label={`Remove ${person.name || "this person"}`}>×</button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="setup-add"
              onClick={() => update({ people: [...team.people, { name: "", role: team.roles[0].id, days: days.map((_, i) => i < 5), shifts: 3 }] })}>
              + Add person
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <p className="setup-help">Click a cell to add one more of that role (click past the most to clear it). Up to {maxPerShift} people a shift.</p>
            <div className="setup-week" style={{ "--days": days.length } as CSSProperties}>
              <span />
              {days.map(day => <b key={day}>{day}</b>)}
              <span />
              {team.roles.flatMap(role => [0, 1].map(half => (
                <div className="setup-week-row" key={`${role.id}-${half}`} style={{ "--role": role.colour } as CSSProperties}>
                  <b>{role.label || "Role"} <small>{team.shiftNames[half]}</small></b>
                  {days.map((day, d) => {
                    const shift = d + half * 7;
                    const count = team.needs[shift]?.[role.id] ?? 0;
                    return (
                      <button key={day} type="button" data-count={count}
                        aria-label={`${shiftLabel(team.shiftNames, shift)}: ${count} ${role.label || "role"}`}
                        onClick={() => bump(shift, role.id, 1)}
                        onContextMenu={event => { event.preventDefault(); bump(shift, role.id, -1); }}>
                        {count || ""}
                      </button>
                    );
                  })}
                  <span className="setup-row-actions">
                    <button type="button" onClick={() => fillRow(role.id, half, 1)} title="One on every weekday">Mon–Fri</button>
                    <button type="button" onClick={() => update({ needs: team.needs.map((need, shift) => ((shift < 7 ? 0 : 1) === half ? { ...need, [role.id]: 0 } : need)) })}
                      title="Clear this row">Clear</button>
                  </span>
                </div>
              )))}
            </div>
          </>
        )}
      </div>

      <footer className="setup-foot">
        <ul className="setup-checks" aria-live="polite">
          <li className="setup-total"><b>{check.needed}</b> places to fill · <b>{named.length}</b> people</li>
          {check.gaps.slice(0, 2).map(({ shift, role }, i) => (
            <li key={i}>Nobody can work {shiftLabel(team.shiftNames, shift)} as {roleIn(team.roles, role).label.toLowerCase() || "that role"}.</li>
          ))}
          {check.gaps.length > 2 && <li>…and {check.gaps.length - 2} more places nobody can work.</li>}
          {check.short.map(({ id, label, need, have }) => (
            <li key={id}>{label || "A role"} needs {need} shifts but the team only has {have}.</li>
          ))}
          {ready && !check.gaps.length && !check.short.length && <li className="setup-ok">Every place has someone who can work it.</li>}
        </ul>
        <div className="setup-actions">
          <button type="button" className="btn btn-ghost" onClick={() => (step ? setStep(step - 1) : onBack())}>{step ? "Back" : "Menu"}</button>
          {step < steps.length - 1 && <button type="button" className="btn btn-soft" onClick={() => setStep(step + 1)}>Next</button>}
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={onPlay}>Play this week ▶</button>
        </div>
      </footer>
    </div>
  );
}
