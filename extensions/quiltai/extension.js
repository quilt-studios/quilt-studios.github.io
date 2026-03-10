/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const cp = require('child_process');
const qc = require('vscode');

const MAX_SESSIONS = 40;
const MAX_MESSAGES_PER_SESSION = 120;
const MAX_ACTIVITY_ITEMS = 160;
const SESSIONS_STORAGE_KEY = 'quiltai.sessions.v1';
const ACTIVE_SESSION_STORAGE_KEY = 'quiltai.activeSession.v1';
const ONBOARDING_STORAGE_KEY = 'quiltai.onboarded.v1';
const PREINSTALLED_EXTENSION_KEY = 'quiltai.preinstalledExtensions.v1';

/**
 * @param {qc.ExtensionContext} context
 */
function activate(context) {
	const assistant = new QuiltAiAssistant(context);
	context.subscriptions.push(assistant);

	context.subscriptions.push(qc.commands.registerCommand('quiltai.openAssistant', () => assistant.focus()));
	context.subscriptions.push(qc.commands.registerCommand('quiltai.ask', () => assistant.askFromCommandPalette()));
	context.subscriptions.push(qc.commands.registerCommand('quiltai.explainSelection', () => assistant.explainSelection()));
	context.subscriptions.push(qc.commands.registerCommand('quiltai.generateDocComment', () => assistant.generateDocComment()));
	context.subscriptions.push(qc.commands.registerCommand('quiltai.auditWorkspace', () => assistant.auditWorkspace()));
	context.subscriptions.push(qc.commands.registerCommand('quiltai.runSystemCommand', () => assistant.runSystemCommandFlow()));
	context.subscriptions.push(qc.window.registerWebviewViewProvider('quiltai.sidebar', assistant, { webviewOptions: { retainContextWhenHidden: true } }));
}

class QuiltAiAssistant {
	/**
	 * @param {qc.ExtensionContext} context
	 */
	constructor(context) {
		this._context = context;
		this._view = undefined;
		this._outputChannel = undefined;
		this._sessions = this._context.globalState.get(SESSIONS_STORAGE_KEY, []);
		this._activeSessionId = this._context.globalState.get(ACTIVE_SESSION_STORAGE_KEY);
		this._ensureSession(qc.l10n.t('New Chat'));
		void this._ensureProviderSetupOnce();
	}

	_findActiveSession() {
		return this._sessions.find(session => session.id === this._activeSessionId);
	}

	async _ensureProviderSetupOnce() {
		if (this._context.globalState.get(ONBOARDING_STORAGE_KEY, false)) {
			return;
		}

		const providerChoice = await qc.window.showQuickPick([
			{ label: 'OpenRouter API', value: 'openrouter' },
			{ label: 'Google Gemini API', value: 'googleGemini' }
		], {
			title: qc.l10n.t('Set Up QuiltAI for QuiltyCode'),
			placeHolder: qc.l10n.t('Choose your AI provider to start chatting')
		});
		if (!providerChoice) {
			return;
		}

		const apiKey = await qc.window.showInputBox({
			title: providerChoice.value === 'googleGemini' ? 'Google Gemini API Key' : 'OpenRouter API Key',
			prompt: qc.l10n.t('Paste your API key. It will be stored in your user settings.'),
			password: true,
			ignoreFocusOut: true
		});

		if (!apiKey) {
			return;
		}

		const target = qc.ConfigurationTarget.Global;
		await qc.workspace.getConfiguration('quiltai').update('provider', providerChoice.value, target);
		if (providerChoice.value === 'googleGemini') {
			await qc.workspace.getConfiguration('quiltai').update('googleGeminiApiKey', apiKey, target);
		} else {
			await qc.workspace.getConfiguration('quiltai').update('openRouterApiKey', apiKey, target);
		}

		await this._context.globalState.update(ONBOARDING_STORAGE_KEY, true);
		await this._installRecommendedExtensionsOnce();
		void qc.window.showInformationMessage(qc.l10n.t('QuiltAI is ready in QuiltyCode.'));
	}

	async _installRecommendedExtensionsOnce() {
		if (this._context.globalState.get(PREINSTALLED_EXTENSION_KEY, false)) {
			return;
		}
		const extensionIds = ['openai.chatgpt-codex', 'anthropic.claude-code'];
		for (const extensionId of extensionIds) {
			try {
				await qc.commands.executeCommand('workbench.extensions.installExtension', extensionId);
			} catch (error) {
				this._showInOutput(`Default extension install skipped for ${extensionId}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		await this._context.globalState.update(PREINSTALLED_EXTENSION_KEY, true);
	}

	dispose() {
		if (this._outputChannel) {
			this._outputChannel.dispose();
		}
	}

	focus() {
		void qc.commands.executeCommand('quiltai.sidebar.focus');
	}

	getProvider() {
		return qc.workspace.getConfiguration('quiltai').get('provider', 'openrouter');
	}

	getDefaultModel() {
		const config = qc.workspace.getConfiguration('quiltai');
		return this.getProvider() === 'googleGemini'
			? config.get('googleGeminiModel', 'gemini-2.5-pro')
			: config.get('openRouterModel', 'google/gemini-2.5-pro');
	}

	/**
	 * @param {qc.WebviewView} view
	 */
	resolveWebviewView(view) {
		this._view = view;
		view.webview.options = { enableScripts: true };
		view.webview.html = this._renderHtml(view.webview);

		view.webview.onDidReceiveMessage(async message => {
			switch (message?.type) {
				case 'newChat':
					this._createSession(qc.l10n.t('New Chat'));
					break;
				case 'switchChat':
					if (typeof message.sessionId === 'string') {
						this._activeSessionId = message.sessionId;
						await this._persistSessions();
					}
					break;
				case 'deleteChat':
					if (typeof message.sessionId === 'string') {
						this._deleteSession(message.sessionId);
					}
					break;
				case 'renameChat':
					if (typeof message.sessionId === 'string' && typeof message.title === 'string') {
						this._renameSession(message.sessionId, message.title);
					}
					break;
				case 'duplicateChat':
					if (typeof message.sessionId === 'string') {
						this._duplicateSession(message.sessionId);
					}
					break;
				case 'clearActivity': {
					const activeSession = this._findActiveSession();
					if (activeSession) {
						activeSession.activities = [];
						await this._persistSessions();
					}
					break;
				}
				case 'retryLastPrompt': {
					const activeSession = this._findActiveSession();
					const lastUserMessage = activeSession?.entries?.slice().reverse().find(entry => entry.role === 'user');
					if (lastUserMessage?.content) {
						await this.handlePrompt(String(lastUserMessage.content), this.getDefaultModel());
					}
					break;
				}
				case 'saveTranscript':
					await this._saveActiveTranscript();
					break;
				case 'copyLastAnswer': {
					const activeSession = this._findActiveSession();
					const lastAssistantMessage = activeSession?.entries?.slice().reverse().find(entry => entry.role === 'assistant' && !entry.isError);
					if (lastAssistantMessage?.content) {
						await qc.env.clipboard.writeText(String(lastAssistantMessage.content));
						void qc.window.showInformationMessage(qc.l10n.t('Copied latest QuiltAI answer to clipboard.'));
					}
					break;
				}
				case 'useTemplate':
					if (typeof message.template === 'string') {
						await this.handlePrompt(message.template, this.getDefaultModel());
					}
					break;
				case 'switchProvider':
					if (message.provider === 'openrouter' || message.provider === 'googleGemini') {
						await qc.workspace.getConfiguration('quiltai').update('provider', message.provider, qc.ConfigurationTarget.Global);
					}
					break;
				case 'ask': {
					const prompt = typeof message.prompt === 'string' ? message.prompt.trim() : '';
					if (!prompt) {
						return;
					}
					const model = typeof message.model === 'string' && message.model.trim().length > 0 ? message.model.trim() : this.getDefaultModel();
					await this.handlePrompt(prompt, model);
					break;
				}
				case 'explainSelection':
					await this.explainSelection();
					break;
				case 'generateDocComment':
					await this.generateDocComment();
					break;
				case 'auditWorkspace':
					await this.auditWorkspace();
					break;
				case 'runSystemCommand':
					await this.runSystemCommandFlow(message.command, Boolean(message.useSudo));
					break;
			}

			this._postState();
		});

		this._postState();
	}

	async askFromCommandPalette() {
		const prompt = await qc.window.showInputBox({
			title: qc.l10n.t('Ask QuiltAI'),
			prompt: qc.l10n.t('Type your coding question or task request.')
		});
		if (!prompt) {
			return;
		}

		const model = await qc.window.showInputBox({
			title: qc.l10n.t('Model ID'),
			prompt: qc.l10n.t('Optional model override, for example dev/model or gemini-2.5-pro.'),
			value: this.getDefaultModel()
		});

		await this.handlePrompt(prompt, model || this.getDefaultModel());
	}

	async handlePrompt(prompt, model) {
		this._addEntry('user', prompt);
		this._addActivity('prompt', `Sent prompt to ${model}`);
		await this._persistSessions();

		const editor = qc.window.activeTextEditor;
		const requestPrompt = [
			'User prompt:',
			prompt,
			'',
			'If you decide to modify files, emit blocks in this exact format:',
			'```quilt-edit path=relative/path/from/workspace',
			'<full file content>',
			'```',
			'',
			'If you decide to run commands, emit blocks in this exact format:',
			'```quilt-cmd',
			'<single shell command>',
			'```',
			'',
			'Editor context:',
			editor ? this._getSelectionSummary(editor) : 'No active editor context.'
		].join('\n');

		try {
			const answer = await this._callProvider(requestPrompt, model);
			this._addEntry('assistant', answer, model);
			await this._applyAssistantAutomation(answer);
			this._showInOutput(`Model: ${model}\n\n${answer}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this._addEntry('assistant', `Request failed: ${message}`, model, true);
			this._addActivity('error', message);
			void qc.window.showErrorMessage(qc.l10n.t('QuiltAI request failed: {0}', message));
		}

		await this._persistSessions();
	}

	async explainSelection() {
		const editor = qc.window.activeTextEditor;
		if (!editor || editor.selection.isEmpty) {
			void qc.window.showInformationMessage(qc.l10n.t('Select code first to use Explain Selection.'));
			return;
		}

		const prompt = [
			'Explain this selection, list potential issues, and suggest improvements.',
			this._codeFence(editor.document.languageId, editor.document.getText(editor.selection))
		].join('\n\n');
		await this.handlePrompt(prompt, this.getDefaultModel());
	}

	async generateDocComment() {
		const editor = qc.window.activeTextEditor;
		if (!editor || editor.selection.isEmpty) {
			void qc.window.showInformationMessage(qc.l10n.t('Select a function body or signature first.'));
			return;
		}

		const prompt = [
			'Create a concise JSDoc/TSDoc style comment for this code. Output only the comment block.',
			this._codeFence(editor.document.languageId, editor.document.getText(editor.selection))
		].join('\n\n');

		try {
			const answer = await this._callProvider(prompt, this.getDefaultModel());
			await editor.edit(builder => {
				builder.insert(editor.selection.start, `${answer.trim()}\n`);
			});
			this._addEntry('assistant', answer, this.getDefaultModel());
			await this._persistSessions();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			void qc.window.showErrorMessage(qc.l10n.t('Doc comment generation failed: {0}', message));
		}
	}

	async auditWorkspace() {
		const files = await qc.workspace.findFiles('**/*.{ts,tsx,js,jsx,py,go,java,cs,rs,md}', '**/{node_modules,out,dist,.git}/**', 200);
		const prompt = [
			'Provide a quick engineering audit checklist for this repository file sample.',
			`Scanned files: ${files.length}`,
			files.slice(0, 30).map(file => `- ${file.path}`).join('\n') || '- No files found.'
		].join('\n\n');
		await this.handlePrompt(prompt, this.getDefaultModel());
	}

	async runSystemCommandFlow(initialCommand, useSudo) {
		const config = qc.workspace.getConfiguration('quiltai');
		if (!config.get('enableSystemAccess', false)) {
			void qc.window.showWarningMessage(qc.l10n.t('System access is disabled. Enable quiltai.enableSystemAccess in settings first.'));
			return;
		}

		const command = initialCommand || await qc.window.showInputBox({
			title: qc.l10n.t('Run System Command'),
			prompt: qc.l10n.t('Enter a shell command to run locally.'),
			placeHolder: 'ls -la /'
		});
		if (!command) {
			return;
		}

		const confirmed = await qc.window.showWarningMessage(qc.l10n.t('Run this command with full local access? {0}', command), { modal: true }, qc.l10n.t('Run'));
		if (!confirmed) {
			return;
		}

		const needsSudo = useSudo || /^\s*sudo\b/u.test(command);
		const sudoPassword = needsSudo ? await qc.window.showInputBox({
			title: qc.l10n.t('Sudo Password'),
			prompt: qc.l10n.t('Enter your sudo password for this command execution.'),
			password: true,
			ignoreFocusOut: true
		}) : undefined;
		if (needsSudo && !sudoPassword) {
			return;
		}

		const result = await this._runShellCommand(command, sudoPassword);
		const response = [
			`Command: ${command}`,
			`Exit Code: ${result.code}`,
			'',
			'--- stdout ---',
			result.stdout || '(empty)',
			'',
			'--- stderr ---',
			result.stderr || '(empty)'
		].join('\n');
		this._addEntry('assistant', response);
		this._addActivity('command', `${command} (exit ${result.code})`);
		this._showInOutput(response);
		await this._persistSessions();
	}

	async _applyAssistantAutomation(answer) {
		const config = qc.workspace.getConfiguration('quiltai');
		const workspaceRoot = qc.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceRoot) {
			return;
		}

		const editBlocks = [...answer.matchAll(/```quilt-edit\s+path=(.+?)\n([\s\S]*?)```/gu)];
		if (config.get('allowAutoWrite', true)) {
			for (const block of editBlocks) {
				const relativePath = block[1].trim();
				const content = block[2] ?? '';
				const fullPath = qc.Uri.joinPath(qc.Uri.file(workspaceRoot), relativePath);
				if (!fullPath.fsPath.startsWith(workspaceRoot)) {
					continue;
				}
				await qc.workspace.fs.writeFile(fullPath, Buffer.from(content, 'utf8'));
				this._addActivity('file', `Wrote ${relativePath}`);
			}
		}

		const commandBlocks = [...answer.matchAll(/```quilt-cmd\n([\s\S]*?)```/gu)];
		if (config.get('allowAutoCommandExecution', true) && config.get('enableSystemAccess', false)) {
			for (const block of commandBlocks) {
				const command = (block[1] || '').trim();
				if (!command) {
					continue;
				}
				const result = await this._runShellCommand(command);
				this._addActivity('command', `${command} (exit ${result.code})`);
			}
		}
	}

	_runShellCommand(command, sudoPassword) {
		return new Promise((resolve, reject) => {
			const commandWithoutSudo = command.replace(/^\s*sudo\s+/u, '');
			const wrapped = sudoPassword ? `sudo -S bash -lc ${JSON.stringify(commandWithoutSudo)}` : `bash -lc ${JSON.stringify(command)}`;
			const child = cp.spawn('bash', ['-lc', wrapped], {
				cwd: qc.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
				env: process.env
			});
			let stdout = '';
			let stderr = '';
			child.stdout.on('data', chunk => {
				stdout += chunk.toString();
			});
			child.stderr.on('data', chunk => {
				stderr += chunk.toString();
			});
			child.on('error', reject);
			child.on('close', code => {
				resolve({ code: code ?? -1, stdout, stderr });
			});
			if (sudoPassword) {
				child.stdin.write(`${sudoPassword}\n`);
			}
			child.stdin.end();
		});
	}

	async _callProvider(prompt, model) {
		return this.getProvider() === 'googleGemini' ? this._callGoogleGemini(prompt, model) : this._callOpenRouter(prompt, model);
	}

	async _callOpenRouter(prompt, model) {
		const config = this._getOpenRouterConfig();
		const response = await fetch(`${config.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${config.apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://quiltycode.local',
				'X-Title': 'QuiltAI'
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: 'system', content: config.systemPrompt },
					{ role: 'user', content: prompt }
				],
				temperature: 0.2
			})
		});
		if (!response.ok) {
			throw new Error(`OpenRouter HTTP ${response.status}: ${await response.text()}`);
		}
		const content = (await response.json())?.choices?.[0]?.message?.content;
		if (!content || typeof content !== 'string') {
			throw new Error('No assistant content returned by OpenRouter provider.');
		}
		return content;
	}

	async _callGoogleGemini(prompt, model) {
		const config = this._getGoogleGeminiConfig();
		const response = await fetch(`${config.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: config.systemPrompt }] },
				contents: [{ role: 'user', parts: [{ text: prompt }] }],
				generationConfig: { temperature: 0.2 }
			})
		});
		if (!response.ok) {
			throw new Error(`Gemini HTTP ${response.status}: ${await response.text()}`);
		}
		const parts = (await response.json())?.candidates?.[0]?.content?.parts;
		const text = Array.isArray(parts) ? parts.map(part => typeof part?.text === 'string' ? part.text : '').join('\n').trim() : '';
		if (!text) {
			throw new Error('No assistant content returned by Gemini provider.');
		}
		return text;
	}

	_getOpenRouterConfig() {
		const config = qc.workspace.getConfiguration('quiltai');
		const apiKey = config.get('openRouterApiKey', '') || process.env.OPENROUTER_API_KEY;
		if (!apiKey) {
			throw new Error('Missing OpenRouter API key. Set quiltai.openRouterApiKey or OPENROUTER_API_KEY.');
		}
		return {
			apiKey,
			baseUrl: config.get('openRouterBaseUrl', 'https://openrouter.ai/api/v1').replace(/\/$/u, ''),
			systemPrompt: config.get('systemPrompt', 'You are QuiltAI, an expert coding assistant for QuiltyCode.')
		};
	}

	_getGoogleGeminiConfig() {
		const config = qc.workspace.getConfiguration('quiltai');
		const apiKey = config.get('googleGeminiApiKey', '') || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
		if (!apiKey) {
			throw new Error('Missing Gemini API key. Set quiltai.googleGeminiApiKey, GEMINI_API_KEY, or GOOGLE_API_KEY.');
		}
		return {
			apiKey,
			baseUrl: config.get('googleGeminiBaseUrl', 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/u, ''),
			systemPrompt: config.get('systemPrompt', 'You are QuiltAI, an expert coding assistant for QuiltyCode.')
		};
	}

	/**
	 * @param {qc.TextEditor} editor
	 */
	_getSelectionSummary(editor) {
		const maxLines = qc.workspace.getConfiguration('quiltai').get('maxContextLines', 120);
		const selection = editor.selection;
		const startLine = Math.max(0, selection.start.line - Math.floor(maxLines / 2));
		const endLine = Math.min(editor.document.lineCount - 1, selection.end.line + Math.floor(maxLines / 2));
		const text = editor.document.getText(new qc.Range(startLine, 0, endLine, editor.document.lineAt(endLine).range.end.character));
		return [
			`Active file: ${editor.document.fileName}`,
			`Language: ${editor.document.languageId}`,
			`Focused range: ${selection.start.line + 1}:${selection.start.character + 1}-${selection.end.line + 1}:${selection.end.character + 1}`,
			this._codeFence(editor.document.languageId, text)
		].join('\n\n');
	}

	_addEntry(role, content, model, isError = false) {
		const session = this._ensureSession(qc.l10n.t('New Chat'));
		session.entries.push({
			id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			role,
			content,
			model,
			isError,
			timestamp: new Date().toISOString()
		});
		session.entries = session.entries.slice(-MAX_MESSAGES_PER_SESSION);
		session.updatedAt = Date.now();
		if (!session.title || session.title === 'New Chat') {
			session.title = this._deriveTitleFromEntries(session.entries);
		}
	}

	_addActivity(kind, detail) {
		const session = this._ensureSession(qc.l10n.t('New Chat'));
		session.activities = session.activities || [];
		session.activities.unshift({
			id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			kind,
			detail
		});
		session.activities = session.activities.slice(0, MAX_ACTIVITY_ITEMS);
	}

	_deriveTitleFromEntries(entries) {
		const firstUser = entries.find(entry => entry.role === 'user');
		if (!firstUser?.content) {
			return 'New Chat';
		}
		return firstUser.content.trim().slice(0, 36) || 'New Chat';
	}

	_renameSession(sessionId, title) {
		const normalizedTitle = title.trim().slice(0, 80);
		if (!normalizedTitle) {
			return;
		}
		const target = this._sessions.find(session => session.id === sessionId);
		if (!target) {
			return;
		}
		target.title = normalizedTitle;
		target.updatedAt = Date.now();
		void this._persistSessions();
	}

	_duplicateSession(sessionId) {
		const source = this._sessions.find(session => session.id === sessionId);
		if (!source) {
			return;
		}
		const duplicate = {
			id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			title: `${source.title} Copy`,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			entries: [...source.entries],
			activities: [...(source.activities || [])]
		};
		this._sessions.unshift(duplicate);
		this._sessions = this._sessions.slice(0, MAX_SESSIONS);
		this._activeSessionId = duplicate.id;
		void this._persistSessions();
	}

	async _saveActiveTranscript() {
		const active = this._findActiveSession();
		if (!active) {
			return;
		}
		const content = [
			`# ${active.title}`,
			'',
			...active.entries.map(entry => `## ${entry.role}${entry.model ? ` (${entry.model})` : ''}\n\n${entry.content}`)
		].join('\n\n');
		const uri = await qc.window.showSaveDialog({
			title: qc.l10n.t('Save QuiltAI Transcript'),
			defaultUri: qc.Uri.file(`${active.title.replace(/[^a-z0-9-_]+/giu, '-').toLowerCase() || 'quiltai-chat'}.md`),
			filters: { Markdown: ['md'], Text: ['txt'] }
		});
		if (!uri) {
			return;
		}
		await qc.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
		void qc.window.showInformationMessage(qc.l10n.t('Saved transcript to {0}', uri.fsPath));
	}

	_createSession(title) {
		const session = {
			id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			title,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			entries: [],
			activities: []
		};
		this._sessions.unshift(session);
		this._sessions = this._sessions.slice(0, MAX_SESSIONS);
		this._activeSessionId = session.id;
		void this._persistSessions();
		return session;
	}

	_ensureSession(defaultTitle) {
		let session = this._sessions.find(candidate => candidate.id === this._activeSessionId);
		if (!session) {
			session = this._createSession(defaultTitle);
		}
		return session;
	}

	_deleteSession(sessionId) {
		this._sessions = this._sessions.filter(session => session.id !== sessionId);
		if (this._activeSessionId === sessionId) {
			this._activeSessionId = this._sessions[0]?.id;
		}
		this._ensureSession(qc.l10n.t('New Chat'));
		void this._persistSessions();
	}

	async _persistSessions() {
		await this._context.globalState.update(SESSIONS_STORAGE_KEY, this._sessions);
		await this._context.globalState.update(ACTIVE_SESSION_STORAGE_KEY, this._activeSessionId);
	}

	_postState() {
		if (!this._view) {
			return;
		}
		const active = this._sessions.find(session => session.id === this._activeSessionId) || this._ensureSession('New Chat');
		void this._view.webview.postMessage({
			type: 'state',
			provider: this.getProvider(),
			defaultModel: this.getDefaultModel(),
			sessions: this._sessions.map(session => ({ id: session.id, title: session.title, updatedAt: session.updatedAt, messageCount: session.entries.length })),
			activeSessionId: active.id,
			messages: active.entries,
			activities: active.activities || []
		});
	}

	_showInOutput(message) {
		if (!this._outputChannel) {
			this._outputChannel = qc.window.createOutputChannel('QuiltAI');
		}
		this._outputChannel.show(true);
		this._outputChannel.appendLine('');
		this._outputChannel.appendLine('='.repeat(64));
		this._outputChannel.appendLine(message);
	}

	_codeFence(languageId, text) {
		const includeLanguage = qc.workspace.getConfiguration('quiltai').get('includeCodeFenceLanguage', true);
		return `\`\`\`${includeLanguage ? languageId : ''}\n${text}\n\`\`\``;
	}

	_renderHtml(webview) {
		const nonce = `${Date.now()}${Math.random().toString(16).slice(2)}`;
		const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="${csp}" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>QuiltAI</title>
	<style>
		body { margin: 0; padding: 10px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); }
		.layout { display: grid; grid-template-columns: 220px 1fr; gap: 10px; min-height: calc(100vh - 20px); }
		.panel { border: 1px solid var(--vscode-editorWidget-border); border-radius: 14px; background: var(--vscode-editorWidget-background); }
		.sidebar { padding: 12px; }
		.main { padding: 0; display: grid; grid-template-rows: auto auto 1fr auto; overflow: hidden; }
		.main-header { padding: 12px 12px 0; display: flex; justify-content: space-between; align-items: center; }
		.btn { border-radius: 10px; border: 1px solid var(--vscode-button-border, transparent); background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 7px 9px; cursor: pointer; }
		.btn:hover { background: var(--vscode-button-hoverBackground); }
		.chat-item { width: 100%; text-align: left; margin-top: 6px; background: transparent; border: 1px solid var(--vscode-editorWidget-border); color: var(--vscode-foreground); border-radius: 10px; padding: 8px; position: relative; }
		.chat-item.active { border-color: var(--vscode-focusBorder); }
		.chat-del { position: absolute; right: 6px; top: 6px; border: none; background: transparent; color: var(--vscode-descriptionForeground); cursor: pointer; }
		.input, textarea { width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); padding: 8px; }
		textarea { min-height: 76px; max-height: 150px; resize: vertical; }
		.toolbar { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; padding: 0 12px 8px; }
		.activity { border-top: 1px solid var(--vscode-editorWidget-border); border-bottom: 1px solid var(--vscode-editorWidget-border); padding: 8px 12px; max-height: 128px; overflow: auto; font-size: 11px; }
		.activity-item { padding: 3px 0; border-top: 1px solid var(--vscode-editorWidget-border); }
		.activity-item:first-child { border-top: none; }
		.message-list { display: grid; gap: 8px; overflow: auto; padding: 8px 12px; }
		.msg { border-radius: 12px; border: 1px solid var(--vscode-editorWidget-border); padding: 10px; white-space: pre-wrap; line-height: 1.4; }
		.msg.user { background: var(--vscode-textCodeBlock-background); }
		.msg.assistant.error { border-color: var(--vscode-errorForeground); }
		.meta { font-size: 11px; opacity: 0.8; }
		.topbar { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
		.composer { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid var(--vscode-editorWidget-border); }
		.pills { display: flex; gap: 6px; padding: 0 12px 10px; }
		.pill { font-size: 11px; border: 1px solid var(--vscode-editorWidget-border); padding: 2px 7px; border-radius: 999px; }
	</style>
</head>
<body>
	<div class="layout">
		<div class="panel sidebar">
			<div class="topbar">
				<strong>Chats</strong>
				<div style="display:flex; gap:6px"><button id="duplicateChat" class="btn">Duplicate</button><button id="newChat" class="btn">+ New</button></div>
			</div>
			<div id="sessionList"></div>
		</div>
		<div class="panel main">
			<div class="main-header">
				<div>
					<strong>QuiltAI</strong>
					<div class="meta" id="providerMeta">Provider: -</div>
				</div>
				<input id="model" class="input" style="max-width: 280px" placeholder="model id (dev/model)" />
			</div>
			<div class="pills"><div class="pill" data-template="Plan an implementation strategy for this task with numbered steps.">Plan</div><div class="pill" data-template="Generate production-ready code changes for this task.">Code</div><div class="pill" data-template="Suggest shell commands to build, test, and validate this change.">Run</div><div class="pill" data-template="Write comprehensive tests for my current change and explain coverage gaps.">Test</div></div>
			<div class="toolbar">
				<button id="explain" class="btn">Explain Selection</button>
				<button id="doc" class="btn">Generate Doc Comment</button>
				<button id="audit" class="btn">Audit Workspace</button>
				<button id="retry" class="btn">Retry Last Prompt</button>
				<button id="copyLast" class="btn">Copy Last Answer</button>
				<button id="saveTranscript" class="btn">Save Transcript</button>
				<button id="clearActivity" class="btn">Clear Activity</button>
				<button id="switchProvider" class="btn">Toggle Provider</button>
			</div>
			<div id="activity" class="activity"></div>
			<div id="messages" class="message-list"></div>
			<div class="composer">
				<textarea id="prompt" placeholder="Ask QuiltAI to plan, edit files, and run tasks..."></textarea>
				<button id="ask" class="btn">Send</button>
			</div>
		</div>
	</div>
	<script nonce="${nonce}">
		const qc = acquireVsCodeApi();
		const model = document.getElementById('model');
		const prompt = document.getElementById('prompt');
		const activity = document.getElementById('activity');
		const providerMeta = document.getElementById('providerMeta');
		const sessionList = document.getElementById('sessionList');
		const messages = document.getElementById('messages');
		let activeSessionId = undefined;

		document.getElementById('newChat').addEventListener('click', () => qc.postMessage({ type: 'newChat' }));
		document.getElementById('ask').addEventListener('click', () => qc.postMessage({ type: 'ask', prompt: prompt.value, model: model.value }));
		document.getElementById('explain').addEventListener('click', () => qc.postMessage({ type: 'explainSelection' }));
		document.getElementById('doc').addEventListener('click', () => qc.postMessage({ type: 'generateDocComment' }));
		document.getElementById('audit').addEventListener('click', () => qc.postMessage({ type: 'auditWorkspace' }));

		document.getElementById('duplicateChat').addEventListener('click', () => { if (activeSessionId) { qc.postMessage({ type: 'duplicateChat', sessionId: activeSessionId }); } });
		document.getElementById('retry').addEventListener('click', () => qc.postMessage({ type: 'retryLastPrompt' }));
		document.getElementById('copyLast').addEventListener('click', () => qc.postMessage({ type: 'copyLastAnswer' }));
		document.getElementById('saveTranscript').addEventListener('click', () => qc.postMessage({ type: 'saveTranscript' }));
		document.getElementById('clearActivity').addEventListener('click', () => qc.postMessage({ type: 'clearActivity' }));
		document.getElementById('switchProvider').addEventListener('click', () => qc.postMessage({ type: 'switchProvider', provider: providerMeta.textContent.includes('openrouter') ? 'googleGemini' : 'openrouter' }));
		document.querySelectorAll('[data-template]').forEach(item => item.addEventListener('click', () => qc.postMessage({ type: 'useTemplate', template: item.getAttribute('data-template') })));


		window.addEventListener('message', event => {
			const state = event.data;
			if (state.type !== 'state') {
				return;
			}
			if (!model.value && state.defaultModel) {
				model.value = state.defaultModel;
			}
			providerMeta.textContent = 'Provider: ' + (state.provider || '-');
			activeSessionId = state.activeSessionId;

			sessionList.innerHTML = (state.sessions || []).map(session => {
				const cls = session.id === state.activeSessionId ? 'chat-item active' : 'chat-item';
				const safeTitle = String(session.title || 'New Chat').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
				return '<div class="' + cls + '" data-id="' + session.id + '">' + safeTitle + ' (' + session.messageCount + ')<button class="chat-rename" data-rename="' + session.id + '">✎</button><button class="chat-del" data-del="' + session.id + '">×</button></div>';
			}).join('');
			sessionList.querySelectorAll('[data-id]').forEach(item => {
				item.addEventListener('click', eventItem => {
					if (eventItem.target && eventItem.target.getAttribute('data-rename')) {
						const title = window.prompt('Rename chat');
						if (title) { qc.postMessage({ type: 'renameChat', sessionId: eventItem.target.getAttribute('data-rename'), title }); }
						eventItem.stopPropagation();
						return;
					}
					if (eventItem.target && eventItem.target.getAttribute('data-del')) {
						qc.postMessage({ type: 'deleteChat', sessionId: eventItem.target.getAttribute('data-del') });
						eventItem.stopPropagation();
						return;
					}
					qc.postMessage({ type: 'switchChat', sessionId: item.getAttribute('data-id') });
				});
			});

			messages.innerHTML = (state.messages || []).map(item => {
				const roleClass = item.role === 'user' ? 'msg user' : ('msg assistant' + (item.isError ? ' error' : ''));
				const safeContent = String(item.content || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
				const safeRole = String(item.role || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
				const safeModel = String(item.model || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
				return '<div class="' + roleClass + '"><strong>' + safeRole + '</strong> ' + (safeModel ? '(' + safeModel + ')' : '') + '\n\n' + safeContent + '</div>';
			}).join('');

			activity.innerHTML = (state.activities || []).map(item => {
				const safeKind = String(item.kind || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
				const safeDetail = String(item.detail || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
				return '<div class="activity-item"><strong>' + safeKind + '</strong>: ' + safeDetail + '</div>';
			}).join('');
		});
	</script>
</body>
</html>`;
	}
}

function deactivate() {
	return undefined;
}

module.exports = {
	activate,
	deactivate
};
