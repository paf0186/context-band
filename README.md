# context-band

A Claude Code mod that keeps the session's context window in view above the
prompt, the way the desktop app's context popover shows it: a coloured bar of
how much of the window each category takes, folding out to the full table
(messages, system tools, memory files, skills, the autocompact buffer, free
space and the deferred tool schemas).

The desktop app's usage ring next to the model picker now shows plan usage, so
the session's context is otherwise a click away. This puts it back on screen.

- **Desktop:** a rounded card with the total, a clock and title that show the session's
  age on hover, a bar whose segments show their
  name, tokens and share when hovered, and a chevron that folds the table out.
- **Terminal:** the same bar and table drawn in text.

It refreshes after every turn. The figures are the local estimate `/context`
starts from, so they can differ slightly from `/context`'s exact counts.

## Install

At the prompt of a terminal session:

```
/plugin install context-band --marketplace paf0186/context-band
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in
every session, the desktop app's local Code sessions included).

From a shell:

```bash
claude plugin install context-band --marketplace paf0186/context-band
```

In the desktop app, where `/plugin` does not run: click + next to the prompt
box, then Plugins, Add marketplace with `paf0186/context-band`, then Add plugin.

## License

MIT
