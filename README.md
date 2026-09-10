# POSIX.js

POSIX.js is an experimental browser-native Unix-like userspace environment built in JavaScript. It explores how far a persistent POSIX-style system can be implemented directly on the Web platform without embedding a conventional Linux virtual machine.

> **Project status:** experimental. POSIX.js is not Linux, is not a complete POSIX implementation, and does not provide full compatibility with Alpine Linux, systemd, Wayland, or native RISC-V Linux binaries yet.

## Current release: 26.0.3

POSIX.js **26.0.3** expands the browser userspace with a larger Unix command set, a richer filesystem layout, safer persistent upgrades and improved runtime diagnostics.

New commands in 26.0.3 include:

- `grep` — pattern matching with `-i`, `-n`, `-v` and fixed-string mode
- `base64` — Base64 encoding and decoding
- `realpath` — resolved absolute paths
- `cksum` — POSIX-style CRC checksum and byte count
- `uniq` — adjacent duplicate filtering with count/duplicate/unique modes
- `cut` — character and delimited field extraction
- `tac` — reverse line order
- `rev` — reverse characters per line
- `update` — inspect and run POSIX.js persistent-system updates

The 26.0.3 migration also adds conventional filesystem locations including `/mnt`, `/opt`, `/proc`, `/root`, `/srv`, `/usr/local`, `/usr/local/bin` and `/var/tmp`. Downgrades are now explicitly refused by the update manager rather than silently replacing newer version metadata.

The `status` command now reports filesystem links, IndexedDB persistence, services, last network fetch, Wayland state and update state in addition to the existing runtime information.

## Goals

1. **Browser-native Unix environment** — filesystem, shell, commands, package handling and process-oriented APIs implemented in JavaScript.
2. **Persistent local system** — system state is stored in IndexedDB so files and configuration survive page reloads and can be migrated between releases.
3. **RISC-V userspace execution** — an in-project RV64 execution engine is being developed for ELF binaries.
4. **Linux ecosystem compatibility experiments** — Alpine APK packages, systemd-like units and Wayland-like interfaces are progressively mapped into browser-native implementations.
5. **Desktop and mobile UI experiments** — UIDE provides a graphical shell, including a touch-first mobile homescreen mode.

## Versioning

- Current version: **26.0.3**
- 2026 releases use the 26.x series; 2027 releases move to 27.x.
- Deployment builds use a separate build identifier and are persisted inside the virtual filesystem.

## Architecture

POSIX.js is modular. `lib/bootstrap.js` reads `build.json`, performs cache recovery and loads CSS and JavaScript subsystems in dependency order.

### Persistent filesystem

The core exposes a Unix-like filesystem model backed by IndexedDB. It supports directories, files, binary files and symbolic links inside a browser-owned virtual filesystem. It is not the host operating system filesystem.

Important system paths include `/etc`, `/home`, `/usr`, `/var`, `/run`, `/dev`, `/tmp`, `/opt`, `/mnt`, `/srv` and POSIX.js metadata under `/var/lib/posixjs`.

### Updates and migrations

Persistent installations are upgraded by `lib/update-manager.js`. Version and build metadata are stored in:

```text
/var/lib/posixjs/system-version
/var/lib/posixjs/system-build
/var/log/posixjs-update.log
```

Use:

```text
update status
update run
update log
```

Migrations preserve existing filesystem content and add required system structures. The updater snapshots runtime state before migration and restores it when a migration fails. A runtime older than the installed system is rejected as a downgrade.

## Shell and commands

Commands are registered independently and each shell command lives in `lib/commands/<name>.js`. Run `help` for the authoritative command list in the loaded build.

The command collection includes filesystem navigation and management, file inspection, text processing, system information, networking helpers, package operations, UIDE controls, themes, Labs and RV64 execution entry points.

Notable text/file tools include `cat`, `head`, `tail`, `tac`, `rev`, `grep`, `cut`, `uniq`, `sort`, `wc`, `base64`, `cksum`, `find`, `tree`, `stat`, `readlink` and `realpath`.

The shell parser is intentionally lightweight and is not yet a complete POSIX shell language implementation. Full pipelines, redirection, shell expansion and scripting semantics remain future work.

## Alpine APK compatibility

POSIX.js contains an experimental Alpine APK compatibility layer. GitHub Actions mirrors selected Alpine RISC-V package metadata and prepares browser-friendly package archives.

```text
apk update
apk search busybox
apk add busybox
apk info
```

This is not yet a complete Alpine package manager. Arbitrary package availability, dependency resolution, package scripts, transactions and complete APK semantics remain incomplete.

## RISC-V execution

`lib/rv64exec.js` is an experimental RV64 userspace execution engine. Work already covers ELF64 RISC-V loading, a growing RV64 instruction subset, virtual memory, filesystem calls, clocks, futex/yield/sleep primitives, local Unix-style sockets and shared-memory emulation.

Compressed RISC-V instructions, full instruction coverage, dynamic ELF loading/relocation, complete process semantics, signals and broader Linux syscall compatibility are still incomplete. Installing a native Alpine package therefore does not imply its executable will run correctly.

## systemd compatibility

POSIX.js provides a lightweight systemd-inspired unit model and `systemctl` interface. It is not the real systemd daemon and does not reproduce Linux process supervision or the complete dependency model.

## Wayland experiments

The browser-side Wayland experiment exposes local Wayland-style endpoints and can bridge selected shared-memory surfaces into UIDE canvas windows. Protocol coverage is partial; complete input/seat handling, descriptor passing, output management and broad client compatibility remain future work.

## UIDE

UIDE is the custom POSIX.js graphical environment. It is not GNOME, KDE or Android.

Desktop mode provides an app registry, desktop, dock/launcher, movable windows, Files, terminal integration, About, Developer Options and experimental Wayland surface windows.

```text
uide start
uide dev
```

### UIDE Mobile

UIDE Mobile is a touch-first graphical shell inspired by modern mobile homescreen interaction patterns.

```text
uide mobile
```

It includes a responsive homescreen, clock/date widget, favorites, translucent dock, searchable app drawer, vertical swipe gestures, mobile app windows, Back/Home/Recents-style controls, iPhone safe-area handling, `visualViewport` support and keyboard navigation fallbacks.

## Designs

The `designs` subsystem provides persistent themes and an interactive graphical picker with live preview and keyboard navigation.

```text
designs
designs list
designs next
designs random
designs set dracula
designs preview cyber
```

Themes include Classic, Midnight, Matrix, Nord, Solarized, Light, Dracula, Monokai, Gruvbox, Catppuccin, Tokyo, Ocean, Ember, Violet, Paper, Cyber and additional variants.

## Labs and Mobilemode

Labs contains intentionally experimental features. Mobilemode provides a terminal-focused on-screen keyboard with navigation, history, symbols, modifiers and shell shortcuts where browser behavior permits suppression of the normal software keyboard.

```text
labs list
labs mobilemode on
labs mobilemode off
labs mobilemode status
```

## Nerd Font support

POSIX.js can detect supported Nerd Font families already installed on the device and use their glyphs in the terminal and file listings. The project does not bundle font files.

## Browser support

Mobile Safari, including iPhone, is an important design target. The core model avoids requiring `SharedArrayBuffer`. Web API behavior still differs between Safari, Chromium and Firefox, so not every feature behaves identically across engines.

## Repository structure

```text
index.html                  Browser entry point
build.json                  Release/build manifest
LICENSE.txt                 Plix Free Public License (PFPL) v1.0
css/                        Terminal, UIDE, Labs and design styles
lib/bootstrap.js            Cache-aware module loader
lib/posix-core.js           Core filesystem/runtime state
lib/update-manager.js       Persistent migrations and version stamping
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
- Keep subsystems and commands modular.
- Preserve persistent user state through explicit migrations.
- Keep compatibility claims precise: compatibility layers are not the original Linux components.
- Treat mobile Safari as a first-class constraint.
- Avoid hidden external runtime dependencies where project-owned code can provide the required behavior.

## Known limitations

POSIX.js remains a prototype. It is not a Linux kernel; POSIX coverage and shell semantics are incomplete; RV64 execution and dynamic linking are incomplete; APK dependency resolution is incomplete; systemd and Wayland are compatibility experiments; UIDE applications are browser UI components; and execution performance is constrained by JavaScript and browser sandboxing.

## Roadmap

Major directions include fuller RV64/RVC support, dynamic ELF loading, process/signal semantics, broader syscalls, APK dependency resolution, richer Wayland support, faster CPU execution, stronger update validation, richer shell parsing and more UIDE applications.

## Running POSIX.js

The project is designed for static hosting. Open the GitHub Pages deployment in a modern browser. Persistent state is stored locally by the browser. For development, serve the repository over HTTP rather than `file://` because storage and fetch behavior differ for local files.

## Contributing

New commands should generally be implemented as individual `lib/commands/<command>.js` modules. Persistent filesystem changes should include a migration when required. Deployed asset changes should increment the build identifier so existing installations invalidate stale cached resources.

## License

POSIX.js is distributed under the **Plix Free Public License (PFPL), Version 1.0**. It grants rights to use, study, copy, modify, distribute and sell copies of the software subject to its terms.

See [`LICENSE.txt`](./LICENSE.txt) for the complete and authoritative license text.
