# Lessons

## Reuse active emulator sessions across worktrees

- Before booting or claiming another emulator, check which session already owns the device.
- If the active session belongs to another worktree for this repository, reuse that session and do the emulator work from its owning worktree. Keep the exact `agent-device` launcher, host config, serial, and session flags returned by the device tool.
- Do not stop, free, or duplicate a device session just because the current worktree cannot install to it. Confirm ownership first and reuse the existing Pixel or emulator directly.
- Check `pwd -P`, the Git root, and `git worktree list` before device commands; similarly named checkout paths can cause commands to run from the wrong worktree.
