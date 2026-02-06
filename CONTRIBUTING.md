# Contributing to Canto

First off, thank you for considering contributing to Canto! It's people like you that make Canto such a great tool.

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the [issue list](https://github.com/Excelsi-Innovations/canto/issues) to avoid duplicates.

**To report a bug:**
1. Use the bug report template
2. Include a clear title and description
3. Provide steps to reproduce the issue
4. Include your environment details (OS, Node version, etc.)
5. Add any relevant logs or screenshots

### Suggesting Enhancements

Enhancement suggestions are tracked as [GitHub issues](https://github.com/Excelsi-Innovations/canto/issues).

**To suggest an enhancement:**
1. Use the feature request template
2. Explain the problem you're trying to solve
3. Describe the solution you'd like
4. Explain why this enhancement would be useful

### Pull Requests

**Before submitting a pull request:**
1. Check if there's an existing issue for your change
2. Fork the repository and create your branch from `main`
3. Follow the code style guide below
4. Add tests if you're adding functionality
5. Ensure all tests pass
6. Update documentation as needed

## 🔧 Development Setup

### Prerequisites

- Node.js >= 18
- npm or bun
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/Excelsi-Innovations/canto.git
cd canto

# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Run type checker
npm run type-check
```

### Development Workflow

```bash
# Create a feature branch
git checkout -b feature/my-feature

# Make your changes
# ... code code code ...

# Run all checks
npm run lint
npm run type-check
npm run format
npm test

# Commit your changes
git commit -m "feat: add amazing feature"

# Push to your fork
git push origin feature/my-feature

# Create a Pull Request on GitHub
```

## 📋 Code Style Guide

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`, never use `var`
- Use template literals instead of string concatenation
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Avoid `any` - use proper types or `unknown`

### Naming Conventions

- **Variables/Functions**: `camelCase`
- **Classes/Interfaces/Types**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE` for true constants
- **Files**: `kebab-case.ts` or `PascalCase.tsx` (for React components)

### Comments

- Use JSDoc for all public APIs (functions, classes, exports)
- Write comments in English
- Explain "why", not "what" (code should be self-explanatory)
- Keep comments up-to-date with code changes

### Code Organization

- Keep files focused and small (< 300 lines)
- Separate concerns - avoid "god files"
- Use barrel exports (`index.ts`) for clean imports
- Group related functionality in modules

### Example

```typescript
/**
 * Parse configuration file and validate schema
 *
 * @param filePath - Path to configuration file
 * @returns Parsed and validated configuration
 * @throws {ConfigError} When file is invalid or doesn't exist
 */
export function parseConfig(filePath: string): Config {
  const content = readFileSync(filePath, 'utf-8');
  const data = YAML.parse(content);
  return validateConfig(data);
}
```

## ✅ Testing Guidelines

- Write tests for all new features
- Maintain or improve code coverage
- Use descriptive test names
- Group related tests with `describe` blocks
- Mock external dependencies

```typescript
describe('parseConfig', () => {
  it('should parse valid YAML configuration', () => {
    const config = parseConfig('fixtures/valid-config.yaml');
    expect(config.modules).toHaveLength(2);
  });

  it('should throw error for invalid configuration', () => {
    expect(() => parseConfig('fixtures/invalid-config.yaml')).toThrow(ConfigError);
  });
});
```

## 🔒 Contributor License Agreement (CLA)

**By contributing to Canto, you agree to the following terms:**

### Grant of Rights

When you submit a contribution (code, documentation, or other materials) to Canto:

1. **Copyright Grant**: You grant Excelsi and Thiago Santos a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license to use, reproduce, modify, prepare derivative works, publicly display, publicly perform, sublicense, and distribute your contributions and such derivative works.

2. **Patent Grant**: If your contribution includes any patents, you grant Excelsi and Thiago Santos a perpetual, worldwide, non-exclusive, royalty-free, irrevocable patent license to make, use, sell, offer for sale, import, and otherwise transfer your contribution.

3. **Relicensing Rights**: You grant Excelsi the right to relicense your contributions under any license, including but not limited to:
   - The current open-source license (MIT)
   - Future versions of the open-source license
   - Commercial licenses for enterprise customers
   - Proprietary licenses for specific use cases

### Your Certifications

By submitting a contribution, you certify that:

1. ✅ You own the copyright to your contribution, or you have the right to submit it under these terms
2. ✅ Your contribution is your original work, or properly attributes third-party work
3. ✅ You understand and agree that your contribution may be used in commercial versions of Canto
4. ✅ You have not signed any agreements that would conflict with this CLA
5. ✅ You agree that Excelsi may use your contribution without attribution in commercial versions

### Why We Need This

The CLA allows us to:
- **Protect the project**: Ensure we have clear rights to all code
- **Offer commercial licenses**: Sell enterprise versions to fund development
- **Change licenses if needed**: Adapt to future legal or business requirements
- **Provide warranties**: Offer legal protections to commercial customers

### What This Means for You

- ✅ Your open-source contributions remain open-source under MIT
- ✅ You retain copyright to your contributions
- ✅ You can use your contributions in your own projects
- ✅ You'll be credited in the contributors list
- ❌ Excelsi can use your contributions in paid commercial versions

### Electronic Signature

By submitting a pull request, you electronically sign this CLA. No separate signature is required.

If you have questions about the CLA, please contact: thiago.santos@excelsi.dev

## 🏆 Recognition

Contributors will be recognized in:
- `CONTRIBUTORS.md` file
- GitHub contributors page
- Release notes (for significant contributions)
- Our website (with permission)

## 📞 Questions?

- **General questions**: Open a [Discussion](https://github.com/Excelsi-Innovations/canto/discussions)
- **Bug reports**: Open an [Issue](https://github.com/Excelsi-Innovations/canto/issues)
- **Security issues**: Email thiago.santos@excelsi.dev (do not open public issues)
- **CLA questions**: Email thiago.santos@excelsi.dev

## 📜 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior:**
- ✅ Using welcoming and inclusive language
- ✅ Being respectful of differing viewpoints
- ✅ Gracefully accepting constructive criticism
- ✅ Focusing on what is best for the community
- ✅ Showing empathy towards others

**Unacceptable behavior:**
- ❌ Trolling, insulting/derogatory comments, personal attacks
- ❌ Public or private harassment
- ❌ Publishing others' private information
- ❌ Other conduct which could reasonably be considered inappropriate

### Enforcement

Violations can be reported to thiago.santos@excelsi.dev. All complaints will be reviewed and investigated promptly and fairly.

---

**Thank you for contributing to Canto!** 🎉

Every contribution, no matter how small, makes a difference.
