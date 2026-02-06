# Changelog

All notable changes to Canto will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-02-06

### 🎉 Initial Release

First public release of Canto - Universal, stack-agnostic CLI dev launcher!

### ✨ Features

#### Core Functionality
- **Multi-stack Support**: Works with Node.js, Python, Go, Rust, or any technology
- **Module Types**: Three module types (workspace, docker, custom)
- **Dependency Management**: Start modules in correct order with `dependsOn`
- **Process Management**: Robust process lifecycle management with PID tracking
- **Cross-Platform**: Full support for Linux, macOS, and Windows

#### Module Types
- **Workspace Module**: Execute commands in Node.js/npm/pnpm/yarn/bun workspaces
- **Docker Module**: Manage Docker Compose services (v1 & v2 compatible)
- **Custom Module**: Run any shell command or script

#### CLI Commands
- `canto init` - Interactive project setup wizard with smart detection
- `canto start [modules...]` - Start one or more modules
- `canto stop [modules...]` - Stop running modules
- `canto restart <module>` - Restart a specific module
- `canto status` - Show status of all modules
- `canto logs <module>` - View module logs with follow mode
- `canto check` - Validate prerequisites

#### Configuration
- **Multiple Formats**: YAML (recommended), JSON, TypeScript, JavaScript
- **Type-Safe**: Zod v4 schema validation
- **Auto-detection**: Smart project structure detection
- **Flexible**: Environment variables, custom paths, conditional execution

#### Developer Experience
- **Beautiful TUI**: Interactive Ink + React terminal interface
- **Auto Port Allocation**: Automatically finds free ports
- **Prerequisites Checking**: Validates Docker, Docker Compose, Node.js versions
- **Centralized Logs**: All logs in `./tmp/*.log`
- **Color-coded Output**: Professional CLI with intuitive colors and icons

#### Advanced Features
- **Dependency Resolution**: Topological sort for correct startup order
- **Process Monitoring**: Track PIDs and process status
- **Graceful Shutdown**: SIGTERM → SIGKILL fallback
- **Environment Variables**: Per-module env var support
- **Working Directory**: Custom CWD for each module

### 📚 Documentation
- Comprehensive README with examples
- Contributing guide with CLA
- Dual licensing (MIT for open source, Commercial for business)
- Code of Conduct

### 🏗️ Architecture
- **TypeScript**: Strict mode with complete type safety
- **Modular Design**: Clean separation of concerns
- **ESLint 9.x**: Flat config with modular rules
- **Prettier**: Consistent code formatting
- **Bun Compatible**: Works with both Node.js and Bun

### 📦 Package
- Published to npm as `canto`
- Global installation: `npm install -g canto`
- Executable: `canto` command available globally

### 🔒 License
- Dual licensed: MIT (open source) + Commercial
- Clear terms for personal vs commercial use
- Contributor License Agreement (CLA)

### 🙏 Credits
- Inspired by monorepo dev scripts (Doutor Vida's `dev.sh`)
- Built with Ink, Commander.js, Zod, and TypeScript
- Developed by Thiago Santos / Excelsi

---

## Version History

### [0.1.0] - 2024-02-06
- Initial release

[Unreleased]: https://github.com/Excelsi-Innovations/canto/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Excelsi-Innovations/canto/releases/tag/v0.1.0
