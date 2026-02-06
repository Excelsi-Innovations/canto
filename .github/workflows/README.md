# GitHub Actions Workflows

Este diretório contém os workflows do GitHub Actions para CI/CD do Canto.

## 📋 Workflows Disponíveis

### 1. CI (Continuous Integration)
**Arquivo:** `ci.yml`  
**Trigger:** Push e Pull Request nas branches `main` e `develop`

**O que faz:**
- Testa em múltiplos ambientes (Ubuntu, Windows, macOS)
- Testa com Node.js (18.x, 20.x, 22.x) e Bun (latest)
- Executa type-check, lint, format check
- Roda build e testes
- Analisa qualidade do código
- Verifica tamanho do pacote

**Jobs:**
- `test`: Matrix testing em diferentes OS e runtimes
- `code-quality`: Análise de qualidade de código

---

### 2. Publish (Publicação)
**Arquivo:** `publish.yml`  
**Trigger:** 
- Automaticamente quando uma release é publicada
- Manualmente via workflow_dispatch (com input de tag)

**O que faz:**
- Valida a versão (package.json vs tag)
- Publica no npm Registry (com provenance)
- Publica no GitHub Packages (scoped)

**Jobs:**
- `publish-npm`: Publica no registry público do npm
- `publish-github`: Publica no GitHub Packages

**Secrets necessários:**
- `NPM_TOKEN`: Token de autenticação do npm (npm access tokens)

---

### 3. Release (Criação de Release)
**Arquivo:** `release.yml`  
**Trigger:**
- Push de tag no formato `v*.*.*` (ex: v0.1.0)
- Manualmente via workflow_dispatch (com input de versão)

**O que faz:**
- Cria GitHub Release com changelog automático
- Compila binários standalone para múltiplas plataformas:
  - Linux x64
  - macOS x64 e ARM64
  - Windows x64
- Gera checksums SHA256 para cada arquivo
- Anexa binários à release

**Jobs:**
- `create-release`: Cria a release no GitHub
- `build-binaries`: Compila binários para cada plataforma
- `create-summary`: Gera resumo da release

---

## 🔧 Configuração Necessária

### Secrets do GitHub

Vá em: **Settings → Secrets and variables → Actions**

#### 1. NPM_TOKEN (Obrigatório para publish)
```bash
# No npm.com, vá em: Account Settings → Access Tokens
# Crie um token do tipo "Automation" ou "Publish"
# Adicione no GitHub: NPM_TOKEN = npm_xxxxxxxxxxxxxxxx
```

#### 2. GITHUB_TOKEN (Automático)
O `GITHUB_TOKEN` é gerado automaticamente pelo GitHub Actions. Não precisa configurar.

---

## 🚀 Como Usar

### CI (Automático)
```bash
# CI roda automaticamente em:
git push origin main
git push origin develop

# Ou em pull requests para essas branches
```

### Publicar no npm
```bash
# Opção 1: Criar release (recomendado)
git tag v0.1.0
git push origin v0.1.0
# Isso dispara o workflow release.yml
# Depois que a release é publicada, publica automaticamente no npm

# Opção 2: Manual via GitHub UI
# Vá em Actions → Publish to npm → Run workflow
# Digite a tag (ex: v0.1.0)
```

### Criar Release
```bash
# Opção 1: Via tag (recomendado)
git tag v0.1.0
git push origin v0.1.0

# Opção 2: Manual via GitHub UI
# Vá em Actions → Release → Run workflow
# Digite a versão (ex: 0.1.0)
```

---

## 📦 Fluxo Completo de Release

```bash
# 1. Atualize a versão no package.json
npm version patch  # ou minor, major

# 2. Atualize o CHANGELOG.md
# Adicione uma seção ## [0.1.1] com as mudanças

# 3. Commit e push
git add .
git commit -m "chore: release v0.1.1"
git push

# 4. Crie e push a tag
git tag v0.1.1
git push origin v0.1.1

# 5. Isso dispara automaticamente:
#    - Release workflow (cria release + binários)
#    - Publish workflow (publica no npm)
```

---

## 🔍 Verificação de Status

### Ver status dos workflows
```bash
# Via GitHub CLI
gh workflow list
gh run list
gh run view <run-id>
```

### Verificar publicação
```bash
# npm
npm view canto

# GitHub Packages
curl https://npm.pkg.github.com/@Excelsi-Innovations/canto
```

---

## 🛠 Desenvolvimento Local

### Testar build antes do release
```bash
# Com npm
npm run validate
npm run build
npm pack --dry-run

# Com Bun
bun run bun:validate
bun run bun:build
```

### Testar instalação local
```bash
# Criar pacote local
npm pack

# Instalar globalmente
npm install -g ./canto-0.1.0.tgz

# Testar
canto --version
canto --help
```

---

## 📝 Checklist antes de Release

- [ ] Todos os testes passando (`npm test`)
- [ ] Type-check sem erros (`npm run type-check`)
- [ ] Lint sem erros (`npm run lint`)
- [ ] Format check OK (`npm run format:check`)
- [ ] Build funciona (`npm run build`)
- [ ] CHANGELOG.md atualizado
- [ ] package.json versão correta
- [ ] README.md atualizado (se necessário)
- [ ] NPM_TOKEN configurado no GitHub Secrets

---

## 🐛 Troubleshooting

### Erro: "Version mismatch"
A versão no `package.json` deve corresponder à tag (sem o `v`).
```bash
# Tag: v0.1.0 → package.json: "version": "0.1.0"
```

### Erro: "NPM_TOKEN not found"
Configure o secret `NPM_TOKEN` no GitHub:
```
Settings → Secrets → Actions → New repository secret
Name: NPM_TOKEN
Value: npm_xxxxxxxxxxxxxxxxxx
```

### Binários não gerados
Certifique-se de que o `package.json` tem a configuração do `pkg`:
```json
{
  "bin": {
    "canto": "./bin/canto.js"
  },
  "pkg": {
    "scripts": ["dist/**/*.js"],
    "assets": ["dist/**/*"]
  }
}
```

---

## 📚 Recursos

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [GitHub Packages](https://docs.github.com/en/packages)
- [pkg - Node.js Binary Compiler](https://github.com/vercel/pkg)
