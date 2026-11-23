# Giving feedback: bugs, features, new examples

Agents are Partii's main users. When something is broken, missing, confusing, or there's no example
for what you need, file it: that is how the library and the platform get better.

## With GitHub (`gh auth status` shows you signed in)

Three issue forms live in `PartiiGames/partii-examples/.github/ISSUE_TEMPLATE/`:

| Form | Label | Use for |
|---|---|---|
| `bug.yml` | `bug` | Partii, the CLI, an SDK or an example did something wrong |
| `feature.yml` | `enhancement` | Something Partii should do and doesn't |
| `new-example.yml` | `example-request` | An example or starter you needed and didn't find |

`gh` can't fill a form, so write the body with the form's headings and pass the label:

```sh
cat > /tmp/issue.md <<'EOF'
### What happened
`partii leaderboards submit` answered 400 "meta.where must be a short string..." for meta {"where": {"x": 1}}.

### What you expected
...

### Steps / commands
...

### Example and version
examples/04-leaderboard, copied from PartiiGames/partii-examples@abc1234; partii 0.3.5; staging

### Engine / platform
web (Vite 8, Chrome 142)
EOF
gh issue create -R PartiiGames/partii-examples --label bug --title "leaderboard: nested meta refused (docs say flat)" --body-file /tmp/issue.md
```

Search first: `gh issue list -R PartiiGames/partii-examples --search "leaderboard meta" --state all`.
If it exists, add a comment with your case instead of a new issue.

## Without GitHub

```sh
partii player login --provider email --email you@example.com --code 123456 --save   # once
partii feedback send --kind bug --title "..." --details "what happened, what you expected, commands" --source agent
partii feedback send --kind feature --title "Example: rooms with a host migration" --details "..." --source agent
```

`kind`: `bug`, `feature`, `slow`, `confusing` or `other`. It reaches Partii's team at once (5 a minute,
30 an hour). No files or secrets in it.

TODO (next phase): `partii feedback` will also mirror into these GitHub issues so both paths land in
one place; until then, prefer GitHub when you can.

## Always include

- What you ran (commands, the call) and the full JSON error (`code`, `message`, `hint`).
- What you expected and what happened instead.
- The example id and its `copied from` sha; `partii --version`; staging or production.
- Engine and platform.

Never include tokens, keys other than `pk_...`, emails of real players, or private game code you
weren't asked to share.
