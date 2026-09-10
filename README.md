# POSIX.js

POSIX.js is an experimental browser-native Unix-like userspace environment built in JavaScript. It explores how far a persistent POSIX-style system can be implemented directly on the Web platform without embedding a conventional Linux virtual machine.

> **Project status:** experimental. POSIX.js is not Linux, is not a complete POSIX implementation, and does not provide full compatibility with Alpine Linux, systemd, Wayland, or native RISC-V Linux binaries yet.

## Goals

POSIX.js focuses on five areas:

1. **Browser-native Unix environment** — filesystem, shell, commands, package handling and process-oriented APIs implemented in JavaScript.
2. **Persistent local system** — system state is stored in IndexedDB so files and configuration can survive page reloads.
3. **RISC-V userspace execution** — an in-project RV64 execution engine is being developed for ELF binaries.
4. **Linux ecosystem compatibility experiments** — Alpine APK packages, systemd-like units and Wayland-like interfaces are progressively mapped into browser-native implementations.
5. **Desktop and mobile UI experiments** — UIDE provides a graphical shell, including a touch-first mobile homescreen mode.

## Current version

- POSIX.js version: **26.0.2.3**
- Versioning follows the calendar-year major series: 26.x for 2026, 27.x for 2027, and so on.
- Deployment builds use a separate build identifier and are persisted inside the virtual filesystem.

## Architecture

POSIX.js is intentionally modular. The browser bootloader loads small subsystems in dependency order rather than keeping the entire environment in one script.

### Boot and updates

`lib/bootstrap.js` loads the current `build.json`, applies cache-busting build identifiers, loads styles and JavaScript modules in order, and attempts to recover from stale browser caches. The update manager tracks both the installed semantic version and deployment build in the virtual filesystem and can run migrations when an older persistent installation is opened by a newer release.

Stored update metadata includes:

```text
/var/lib/posixjs/system-version
/var/lib/posixjs/system-build
/var/log/posixjs-update.log
```

### Virtual filesystem

The POSIX.js core exposes a Unix-like filesystem model with paths, directories, files, links and persistent storage. IndexedDB is used as the persistence layer. This is a browser filesystem model, not a mounted host filesystem.

### Shell

The shell is registry-based. Commands are split into individual JavaScript modules under `lib/commands/`, making commands independently maintainable and reducing the size of monolithic shell code.

Examples include filesystem commands, text utilities, system information, package commands, UIDE controls, design controls and experimental Labs controls.

Run:

```text
help
```

for the command list available in the current build.

### `ls`

`ls` is implemented specifically for the POSIX.js filesystem and supports common listing behavior such as hidden files, long listings, human-readable sizes, recursive traversal, classification and optional Nerd Font icons.

Examples:

```text
ls
ls -lah
ls -R /etc
ls --icons
```

### Nerd Font support

POSIX.js can detect several locally available Nerd Font family names and use them for terminal rendering and supported file icons. Fonts are not bundled by the project; availability depends on fonts installed on the client device.

## Alpine APK compatibility

POSIX.js includes an experimental Alpine APK compatibility layer. A GitHub Actions workflow mirrors selected Alpine RISC-V package metadata and prepares browser-friendly package archives.

The package layer currently focuses on package discovery, downloading, archive extraction and installation into the virtual filesystem. It is **not yet a complete Alpine package manager**: arbitrary packages, dependency resolution, maintainer scripts, transactions and complete package semantics are still areas of development.

Typical commands:

```text
apk update
apk search busybox
apk add busybox
apk info
```

## RISC-V execution

`lib/rv64exec.js` is an experimental RV64 userspace execution engine. It implements a growing subset of RISC-V instructions and Linux-like userspace syscalls using browser-backed resources.

Work in this area includes:

- ELF64 RISC-V loading
- RV64 integer and multiplication/division instruction support
- virtual memory operations
- filesystem syscalls
- clocks and identity calls
- futex/yield/sleep primitives
- local Unix-style socket experiments
- shared-memory emulation

Important missing areas include complete instruction coverage, compressed RISC-V instructions, a full dynamic loader/relocation path, complete process semantics, signals and broader Linux syscall compatibility. Native Alpine executables therefore should not be assumed to work simply because their APK installs successfully.

## systemd compatibility layer

POSIX.js provides a lightweight systemd-inspired unit interface and `systemctl` command. It can parse and manage a subset of service/unit concepts inside the browser environment.

This is not the real systemd daemon and does not reproduce Linux process supervision or the full unit dependency model.

## Wayland experiments

The project contains a minimal browser-side Wayland compatibility experiment. It exposes browser-local Wayland-style endpoints and can bridge selected shared-memory surfaces into UIDE canvas windows.

The implementation is intentionally incomplete. Full Wayland protocol coverage, input/seat handling, descriptor passing, output management and complete client compatibility remain future work.

## UIDE

UIDE is the custom graphical environment for POSIX.js. It is not GNOME, KDE, Android, or another existing desktop environment.

Desktop mode currently provides:

- graphical desktop
- app registry
- dock and launcher
- draggable windows
- minimize/maximize/close controls
- Files application
- terminal handoff
- About application
- Developer Options
- Wayland surface windows

Start it with:

```text
uide start
```

### UIDE Mobile

UIDE Mobile is a touch-first graphical shell inspired by modern mobile homescreen interaction patterns. It does not attempt to emulate Android itself.

Start it with:

```text
uide mobile
```

Current mobile features include:

- responsive homescreen
- large clock/date widget
- favorite app grid
- translucent app dock
- searchable all-apps drawer
- swipe-up and swipe-down drawer gestures
- mobile application windows
- Back, Home and Recents-style navigation controls
- safe-area support for notched devices
- `visualViewport` handling for mobile browser resizing
- keyboard navigation fallbacks
- current POSIX.js build display

## Designs

The `designs` subsystem provides persistent themes for the terminal and related UI. It includes an interactive graphical picker with live preview and keyboard navigation.

Examples:

```text
designs
designs list
designs next
designs random
designs set dracula
designs preview cyber
```

Themes include Classic, Midnight, Matrix, Nord, Solarized, Light, Dracula, Monokai, Gruvbox, Catppuccin, Tokyo, Ocean, Ember, Violet, Paper, Cyber and additional variants.

## Labs

Labs contains features that are intentionally experimental and may change substantially between builds.

### Mobilemode

`mobilemode` replaces normal terminal text entry with a purpose-built on-screen terminal keyboard where browser behavior allows it. The keyboard includes shell-oriented shortcuts, cursor navigation, history controls, symbols and modifier actions.

```text
labs mobilemode on
labs mobilemode off
labs mobilemode status
```

### Developer Options

UIDE Developer Options exposes runtime information such as POSIX.js version/build, viewport state, Nerd Font availability, Wayland state and Labs status, plus selected development actions.

```text
uide dev
```

## Browser support

A major design target is mobile Safari, including iPhone. The project avoids depending on `SharedArrayBuffer` for its core browser model. Browser APIs still differ significantly between engines, so behavior can vary across Safari, Chromium and Firefox.

## Repository structure

```text
index.html                  Browser entry point
build.json                  Release/build manifest
css/                        Terminal, UIDE, Labs and design styles
lib/bootstrap.js            Cache-aware module loader
lib/posix-core.js           Core POSIX.js filesystem/runtime state
lib/update-manager.js       Persistent system migrations
lib/apk.js                  APK compatibility layer
lib/rv64exec.js             Experimental RV64 executor
lib/systemd.js              systemd-inspired compatibility layer
lib/wayland.js              Wayland compatibility experiments
lib/designs.js              Theme engine
lib/labs-mobile.js          Experimental terminal mobile keyboard
lib/uide-core.js            UIDE window/app core
lib/uide-mobile.js          UIDE Mobile homescreen shell
lib/uide-*.js               UIDE applications/integrations
lib/commands/*.js           One JavaScript module per shell command
.github/workflows/          Alpine mirror automation
alpine/                     Generated/mirrored Alpine package data
```

## Development principles

- Prefer browser-native APIs over embedding an existing VM.
- Keep modules small and independently understandable.
- Preserve persistent user state across upgrades through explicit migrations.
- Treat compatibility layers accurately: a command-compatible surface is not the same thing as the original Linux subsystem.
- Keep mobile Safari as an important constraint.
- Avoid hidden external runtime dependencies where project-owned code can provide the required behavior.

## Known limitations

POSIX.js remains a prototype. In particular:

- it is not a Linux kernel;
- POSIX coverage is incomplete;
- RV64 execution is incomplete;
- dynamically linked Linux binaries are not generally compatible yet;
- APK dependency resolution is incomplete;
- systemd support is a compatibility model, not real systemd;
- Wayland support is a small protocol experiment;
- UIDE applications are browser UI components, not native Linux GUI programs;
- performance is constrained by JavaScript execution and browser sandboxing.

## Roadmap

Major technical directions include fuller RV64/RVC support, dynamic ELF loading, process and signal semantics, broader syscall coverage, APK dependency resolution, richer Wayland protocol support, faster CPU execution, stronger update/cache validation, more UIDE applications and deeper touch/mobile integration.

## Running POSIX.js

The project is designed for static hosting. Open the GitHub Pages deployment in a modern browser. The system boots locally in the page and persistent state is stored by the browser.

For development, serve the repository from an HTTP server rather than relying on `file://`, because browser storage, module loading and fetch behavior differ for local files.

## Contributing

Contributions should keep compatibility claims precise and preserve the modular architecture. New shell commands should generally live in their own `lib/commands/<command>.js` module. Changes to persistent system structure should be paired with an update-manager migration when required.

When changing deployed assets, also increment the deployment build identifier so existing installations can invalidate stale cached resources and record the new build.

## License

No license is declared in this README. Check the repository for the project's current licensing terms before redistributing or incorporating the code elsewhere.
