# QuiltAI (Built-In for QuiltyCode)

QuiltAI is a built-in assistant extension for QuiltyCode.

## New Capabilities

- First-run onboarding that asks for provider choice (OpenRouter or Google Gemini) and API key.
- Multi-chat sidebar with persistent chat storage.
- Codex-style workflow with activity stream (prompt, files changed, commands run, errors).
- Coding helpers: Explain Selection, Generate Doc Comment, and Workspace Audit.
- Autonomous coding operations from model output:
  - file updates with `quilt-edit` blocks,
  - command execution with `quilt-cmd` blocks.
- Manual model override (`dev/model` style IDs are supported).

## Configuration

- `quiltai.provider`: `openrouter` or `googleGemini`.
- `quiltai.openRouterApiKey`, `quiltai.googleGeminiApiKey`.
- `quiltai.openRouterModel`, `quiltai.googleGeminiModel`.
- `quiltai.systemPrompt`: instruction prepended to every request.
- `quiltai.allowAutoWrite`: allow autonomous file writes.
- `quiltai.allowAutoCommandExecution`: allow autonomous command execution.
- `quiltai.enableSystemAccess`: enables shell access for autonomous commands.

## Safety

- Autonomous commands only run when `quiltai.enableSystemAccess` is enabled.
- Chats are stored in extension global storage and restored automatically.
