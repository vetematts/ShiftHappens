# Working on Shift Happens together

A few habits that keep four people out of each other's way. Setup and commands are in the [README](README.md); how the code fits together is in [CLAUDE.md](CLAUDE.md).

## Each change

1. Start from the latest `main`: `git switch main && git pull`, then `npm ci` if `package-lock.json` changed.
2. Make a branch named after the change, like `member2/cancel-tuning` or `fix-menu-edges`.
3. Before you push, run `npm run typecheck` and `npm run lint`. If you changed rules in `src/round.ts`, also run `node --experimental-strip-types scripts/simulate.ts` and check the win rates still look sensible and "rosters breaking a rule" is 0.
4. Push the branch and open a pull request. The checks run on it, and once it's merged, GitHub Pages publishes the game within a couple of minutes.

If you worked on something with a teammate, credit them with a `Co-authored-by: Name <email>` line at the end of the commit message.

## Good to know

- Every merge to `main` goes live, so leave anything risky until after a demo.
- `src/round.ts` and `src/office-world.ts` are big and busy. Pull often and keep pull requests small so merges stay easy.
- Don't keep the project in iCloud Drive or Dropbox if you can avoid it. They copy files mid-change and leave things like `README 2.md` behind.
