# Install the Partii skill

Paste this into your coding agent (Claude Code, Codex, Gemini CLI, Cursor, or any other). It
installs one skill, `partii`, from this repo, in the right place for that agent.

---

```text
Install the Partii skill for yourself.

1. Download the folder skill/partii from https://github.com/PartiiGames/partii-examples (branch main):
   curl -fsSL https://codeload.github.com/PartiiGames/partii-examples/tar.gz/main | tar -xz -C "${TMPDIR:-/tmp}" partii-examples-main/skill/partii
   It holds SKILL.md and a references/ folder. Read SKILL.md before installing it.
2. Put the whole partii folder where YOU load skills from, for every project of this user:
   - Claude Code: ~/.claude/skills/partii/
   - Codex: ~/.codex/skills/partii/
   - Gemini CLI, or any agent with a skills folder: that folder, as partii/
   - No skills feature: ~/.partii/skill/partii/, and add one line to your global instructions file
     (AGENTS.md, GEMINI.md, .cursorrules or equivalent): "When working on a Partii game, read
     ~/.partii/skill/partii/SKILL.md first."
   Replace an older copy if there is one. Don't change the files.
3. Check: list the installed folder, then tell me in two lines where you put it and what the skill
   is for. If the partii CLI is missing, tell me the one-line install from SKILL.md; don't run it
   without asking.
```

---

Updating later: paste the same prompt; it replaces the old copy. The skill tells agents to search
`index.json`, copy an example, run its test against Partii staging, and file bugs and example
requests (see `skill/partii/references/feedback.md`).
