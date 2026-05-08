# Superpowers Skill Configuration

## CRITICAL: Skill Usage Rule

**IF THERE IS EVEN A 1% CHANCE A SKILL MIGHT APPLY TO YOUR TASK, YOU ABSOLUTELY MUST INVOKE IT BEFORE ANY RESPONSE OR ACTION.**

This is not optional. This is not negotiable. You cannot rationalize your way out of this.

## Available Skills

This project has the `superpowers` skill installed at `.qwen/skills/superpowers/`.

### Core Superpowers Modules

| Skill | When to Use |
|-------|-------------|
| `superpowers:using-superpowers` | **ALWAYS at conversation start** - establishes skill usage protocol |
| `superpowers:brainstorming` | Before any creative work, feature design, or implementation planning |
| `superpowers:writing-plans` | When creating implementation plans from designs |
| `superpowers:executing-plans` | When implementing planned features |
| `superpowers:test-driven-development` | When writing any code or tests |
| `superpowers:systematic-debugging` | When debugging issues or investigating bugs |
| `superpowers:dispatching-parallel-agents` | For complex multi-step tasks requiring parallel work |
| `superpowers:subagent-driven-development` | When delegating to specialized agents |
| `superpowers:requesting-code-review` | Before submitting code for review |
| `superpowers:receiving-code-review` | When reviewing pull requests |
| `superpowers:using-git-worktrees` | When creating isolated Git workspaces |
| `superpowers:verification-before-completion` | Before marking any task complete |
| `superpowers:finishing-a-development-branch` | When completing branches/PRs |
| `superpowers:writing-skills` | When creating new skills |

## Skill Invocation Flow

```
User message received
    ↓
Might any skill apply? (even 1%)
    ↓ YES
Invoke Skill tool → Announce: "Using [skill] to [purpose]"
    ↓
Follow skill instructions exactly
    ↓
Respond to user
```

## Red Flags (STOP if you think these)

- "This is just a simple question" → Questions are tasks. Check for skills.
- "I need more context first" → Skill check comes BEFORE clarifying questions.
- "Let me explore the codebase first" → Skills tell you HOW to explore. Check first.
- "This doesn't need a formal skill" → If a skill exists, use it.
- "I remember this skill" → Skills evolve. Read current version.
- "This feels productive" → Undisciplined action wastes time. Skills prevent this.

## Skill Priority Order

1. **Process skills first** (brainstorming, debugging, planning) - determine HOW to approach
2. **Implementation skills second** (TDD, execution, review) - guide actual work

Examples:
- "Let's build X" → `brainstorming` first, then implementation skills
- "Fix this bug" → `systematic-debugging` first, then domain skills
