# Canto 🎵

> Universal, stack-agnostic CLI dev launcher for local development

Canto is an open-source command-line tool that centralizes and simplifies local development workflows. Inspired by monorepo dev scripts like `dev.sh`, Canto works with any project structure—whether you're building a monorepo, microservices, or a single application.

[![License: Dual (MIT/Commercial)](https://img.shields.io/badge/License-Dual%20(MIT%2FCommercial)-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.0-orange.svg)](https://bun.sh/)

## ✨ Features

- 🎯 **Stack Agnostic** - Works with Node.js, Python, Go, Rust, or any technology
- 🐳 **Docker Integration** - Manage Docker Compose services seamlessly
- 📦 **Workspace Support** - Built-in support for monorepo workspaces (npm, pnpm, yarn, bun)
- 🔧 **Custom Commands** - Execute any shell command or script
- 📊 **Interactive Menu** - Beautiful TUI with Ink + React
- 🔄 **Dependency Management** - Define module dependencies with `dependsOn`
- 📝 **Centralized Logs** - All module logs in one place (`./tmp/*.log`)
- 🌐 **Cross-Platform** - Works on Linux, macOS, and Windows
- ⚡ **Auto Port Allocation** - Automatically finds free ports when conflicts arise
- 🛡️ **Type-Safe Config** - YAML/JSON configuration with Zod validation

## 🚀 Quick Start

### Installation

```bash
# Global installation (recommended)
npm install -g canto

# Or with bun
bun install -g canto
```

### Initialize Your Project

```bash
cd your-project
canto init
```

This creates a `dev.config.yaml` file in your project root.

### Run the Interactive Menu

```bash
canto
```

Or use direct commands:

```bash
canto start backend    # Start specific module
canto stop all         # Stop all modules
canto logs frontend    # View module logs
canto health           # Check service health
```

## 📖 Configuration

Create a `dev.config.yaml` in your project root:

```yaml
# Optional global settings
global:
  logsDir: ./tmp
  autoAllocatePorts: true
  prerequisites:
    docker: true
    dockerCompose: true

# Define your modules
modules:
  # Docker infrastructure
  - name: infra
    type: docker
    composeFile: ./docker-compose.dev.yaml
    services:
      - postgres
      - redis
      - traefik

  # Backend workspace
  - name: backend
    type: workspace
    path: ./apps/backend
    run:
      dev: npm run dev
      build: npm run build
      test: npm test
    dependsOn:
      - infra
    env:
      NODE_ENV: development
      PORT: "3000"

  # Frontend workspace
  - name: frontend
    type: workspace
    path: ./apps/frontend
    run:
      dev: npm run dev
      build: npm run build
    dependsOn:
      - backend
    packageManager: pnpm

  # Custom script
  - name: worker
    type: custom
    command: node scripts/worker.js
    cwd: ./apps/backend
    dependsOn:
      - infra
```

### Configuration Formats

Canto supports multiple configuration formats:

- **YAML** (recommended): `dev.config.yaml` or `dev.config.yml`
- **JSON**: `dev.config.json`
- **TypeScript/JavaScript** (advanced): `dev.config.ts` or `dev.config.js`

⚠️ **Security Note**: TypeScript/JavaScript configs execute arbitrary code. Only use with trusted sources.

## 🏗️ Module Types

### 1. Workspace Module

Executes commands in a workspace directory (e.g., npm/pnpm packages).

```yaml
- name: backend
  type: workspace
  path: ./apps/backend
  run:
    dev: pnpm run dev
    build: pnpm run build
    test: pnpm test
  packageManager: pnpm  # auto | npm | yarn | pnpm | bun
```

### 2. Docker Module

Manages Docker Compose services.

```yaml
- name: infra
  type: docker
  composeFile: ./docker-compose.yaml
  services:              # Optional: specific services
    - postgres
    - redis
  profiles:              # Optional: Docker Compose profiles
    - dev
```

### 3. Custom Module

Executes any shell command.

```yaml
- name: custom-script
  type: custom
  command: ./scripts/my-script.sh
  cwd: ./tools          # Optional: working directory
```

## 🎯 CLI Commands

```bash
# Interactive menu (default)
canto

# Module management
canto start <module>      # Start specific module
canto start all           # Start all modules
canto stop <module>       # Stop specific module
canto stop all            # Stop all modules
canto restart <module>    # Restart module
canto logs <module>       # View module logs

# Utilities
canto list                # List all modules
canto health              # Health check for services
canto init                # Initialize config file
canto --help              # Show help
```

## 🏃 Examples

### Monorepo with Backend + Frontend + Infra

```yaml
modules:
  - name: infra
    type: docker
    composeFile: ./infra/docker-compose.yaml

  - name: backend
    type: workspace
    path: ./packages/backend
    run:
      dev: pnpm run dev
    dependsOn: [infra]

  - name: frontend
    type: workspace
    path: ./packages/frontend
    run:
      dev: pnpm run dev
    dependsOn: [backend]
```

### Microservices Architecture

```yaml
modules:
  - name: infra
    type: docker
    composeFile: ./docker-compose.yaml

  - name: auth-service
    type: workspace
    path: ./services/auth
    run:
      dev: npm run dev
    dependsOn: [infra]

  - name: api-gateway
    type: workspace
    path: ./services/gateway
    run:
      dev: npm run dev
    dependsOn: [auth-service]

  - name: user-service
    type: workspace
    path: ./services/users
    run:
      dev: npm run dev
    dependsOn: [infra]
```

### Mixed Stack (Node + Python)

```yaml
modules:
  - name: postgres
    type: docker
    composeFile: ./docker-compose.yaml
    services: [postgres]

  - name: node-api
    type: workspace
    path: ./api
    run:
      dev: npm run dev
    dependsOn: [postgres]

  - name: python-worker
    type: custom
    command: python -m uvicorn main:app --reload
    cwd: ./worker
    dependsOn: [postgres]
```

## 🛠️ Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Bun](https://bun.sh/) >= 1.0 (recommended) or npm

### Setup

```bash
git clone https://github.com/Excelsi-Innovations/canto.git
cd canto
npm install
```

### Development Commands

```bash
npm run dev           # Run in watch mode
npm run build         # Build for production
npm test              # Run tests
npm run lint          # Lint code
npm run format        # Format code with Prettier
npm run type-check    # TypeScript type checking
npm run validate      # Run all checks (lint + format + type-check + test)
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Project Structure

```
canto/
├── src/
│   ├── cli/              # CLI interface & Ink menu
│   ├── modules/          # Module implementations (docker, workspace, custom)
│   ├── processes/        # Process management with Bun.spawn
│   ├── config/           # Config parsing & validation
│   ├── utils/            # Cross-platform utilities
│   └── init/             # Init command & templates
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── fixtures/         # Test fixtures
├── bin/                  # Executable entry point
└── reference/            # Reference implementations
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

**Canto is dual-licensed:**

### 🆓 Open Source License (MIT)

For personal, educational, and open-source projects, Canto is free under the [MIT License](./LICENSE-MIT).

**Free for:**
- ✅ Personal projects and side projects
- ✅ Educational purposes (students, teachers, schools)
- ✅ Open-source projects (MIT-compatible licenses)
- ✅ Non-profit organizations
- ✅ Small teams (≤5 developers) using Canto internally

### 💼 Commercial License Required

Commercial use requires a paid license from [Excelsi](https://excelsi.dev).

**Commercial use includes:**
- 🏢 For-profit companies with >5 developers
- 💰 SaaS platforms and commercial products
- 📦 Redistributing Canto in commercial packages
- 🏷️ White-label or rebranded versions

**Benefits:**
- ✅ Priority support with SLA
- ✅ Custom features and integrations
- ✅ Early security updates
- ✅ Legal protection and indemnification
- ✅ Remove attribution requirements

**Pricing:** Starting at $99/month  
**Contact:** thiago.santos@excelsi.dev  
**Details:** [LICENSE-COMMERCIAL](./LICENSE-COMMERCIAL)

---

**Why dual licensing?**  
This model allows us to keep Canto free for the community while sustainably developing enterprise features and providing professional support.

---

For full licensing details, see:
- [LICENSE](./LICENSE) - Dual license overview
- [LICENSE-MIT](./LICENSE-MIT) - Open source terms
- [LICENSE-COMMERCIAL](./LICENSE-COMMERCIAL) - Commercial terms

Copyright (c) 2024 Thiago Santos / Excelsi

## 🙏 Acknowledgments

- Inspired by the `dev.sh` script from the Doutor Vida monorepo
- Built with [Ink](https://github.com/vadimdemedes/ink) for beautiful CLI UIs
- Powered by [Bun](https://bun.sh/) for blazing-fast performance
- Configuration validation with [Zod](https://zod.dev/)

## 🔗 Links

- [Documentation](https://github.com/Excelsi-Innovations/canto/wiki) (Coming soon)
- [Issue Tracker](https://github.com/Excelsi-Innovations/canto/issues)
- [Discussions](https://github.com/Excelsi-Innovations/canto/discussions)

---

**Made with ❤️ by developers, for developers**
