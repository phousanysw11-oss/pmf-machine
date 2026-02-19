/**
 * PMF Machine — automated audit script.
 * Run: node scripts/audit.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SRC = path.join(process.cwd(), 'src');
const report = [];
const issues = [];

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function getAllTsTsx(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.next') getAllTsTsx(full, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const requiredFiles = [
  'src/app/layout.tsx', 'src/app/page.tsx', 'src/app/globals.css',
  'src/lib/database.ts', 'src/lib/supabase.ts', 'src/lib/claude.ts',
  'src/lib/scoring.ts', 'src/lib/gates.ts', 'src/lib/signals.ts',
  'src/lib/uncertainty.ts', 'src/lib/utils.ts', 'src/lib/parseAIJSON.ts',
  'src/app/api/flows/save/route.ts', 'src/app/api/flows/lock/route.ts',
  'src/app/api/products/route.ts', 'src/app/api/ai/route.ts',
  'src/app/api/ai/flow1/route.ts', 'src/app/api/ai/flow2/route.ts',
  'src/app/api/ai/flow3/route.ts', 'src/app/api/ai/flow4/route.ts',
  'src/app/api/ai/flow5/route.ts', 'src/app/api/ai/flow6/route.ts',
  'src/app/api/ai/flow7/route.ts', 'src/app/api/ai/flow8/route.ts',
  'src/app/api/ai/flow9/route.ts', 'src/app/api/ai/flow10/route.ts',
  'src/app/products/[id]/page.tsx',
  'src/app/products/[id]/flow1/page.tsx', 'src/app/products/[id]/flow1/Flow1Client.tsx',
  'src/app/products/[id]/flow2/page.tsx', 'src/app/products/[id]/flow2/Flow2Client.tsx',
  'src/app/products/[id]/flow3/page.tsx', 'src/app/products/[id]/flow3/Flow3Client.tsx',
  'src/app/products/[id]/flow4/page.tsx', 'src/app/products/[id]/flow4/Flow4Client.tsx',
  'src/app/products/[id]/flow5/page.tsx', 'src/app/products/[id]/flow5/Flow5Client.tsx',
  'src/app/products/[id]/flow6/page.tsx', 'src/app/products/[id]/flow6/Flow6Client.tsx',
  'src/app/products/[id]/flow7/page.tsx', 'src/app/products/[id]/flow7/Flow7Client.tsx',
  'src/app/products/[id]/flow8/page.tsx', 'src/app/products/[id]/flow8/Flow8Client.tsx',
  'src/app/products/[id]/flow9/page.tsx', 'src/app/products/[id]/flow9/Flow9Client.tsx',
  'src/app/products/[id]/flow10/page.tsx', 'src/app/products/[id]/flow10/Flow10Client.tsx',
  'src/components/FlowStepper.tsx', 'src/components/flows/FlowContainer.tsx',
  'src/components/LayoutWrapper.tsx', 'src/components/Sidebar.tsx', 'src/components/BottomNav.tsx',
];

function auditFileExists() {
  for (const rel of requiredFiles) {
    const full = path.join(process.cwd(), rel);
    if (!fs.existsSync(full)) {
      issues.push({ file: rel, rule: 'FILE_EXISTS', message: `Missing required file: ${rel}` });
    }
  }
}

function auditUseClientAndImports() {
  const lucideKnown = ['Check', 'AlertTriangle', 'Lock', 'ArrowLeft', 'ChevronLeft', 'ChevronRight', 'ChevronDown', 'Package', 'Plus', 'Play', 'Star', 'Shield', 'Target', 'Zap', 'X', 'LayoutDashboard', 'Settings', 'Menu', 'Loader2', 'AlertCircle', 'BookOpen', 'Layers', 'Home', 'PackageX'];
  const files = getAllTsTsx(SRC);

  for (const filePath of files) {
    const content = readFile(filePath);
    const rel = path.relative(process.cwd(), filePath);

    if (/useState|useEffect|useCallback|useContext|onClick|onChange|onSubmit/.test(content) && !content.includes('use client') && rel.endsWith('.tsx')) {
      issues.push({ file: rel, rule: 'USE_CLIENT', message: 'Uses hooks or events but has no "use client"' });
    }
    if (content.includes('<Link') && !content.includes("from 'next/link'") && !content.includes('from "next/link"')) {
      issues.push({ file: rel, rule: 'IMPORT_LINK', message: 'Uses <Link> but does not import from "next/link"' });
    }
    if (content.includes('useRouter()') && !content.includes('next/navigation')) {
      issues.push({ file: rel, rule: 'IMPORT_USE_ROUTER', message: 'Uses useRouter but does not import from "next/navigation"' });
    }
    if (content.includes('usePathname()') && !content.includes('next/navigation')) {
      issues.push({ file: rel, rule: 'IMPORT_USE_PATHNAME', message: 'Uses usePathname but does not import from "next/navigation"' });
    }
    if (content.includes('useState') && !content.includes("from 'react'") && !content.includes('from "react"')) {
      issues.push({ file: rel, rule: 'IMPORT_REACT', message: 'Uses useState but does not import from "react"' });
    }
    if (content.includes('useEffect') && !content.includes("from 'react'") && !content.includes('from "react"')) {
      issues.push({ file: rel, rule: 'IMPORT_REACT', message: 'Uses useEffect but does not import from "react"' });
    }
    if (content.includes('useCallback') && !content.includes("from 'react'") && !content.includes('from "react"')) {
      issues.push({ file: rel, rule: 'IMPORT_REACT', message: 'Uses useCallback but does not import from "react"' });
    }
    for (const icon of lucideKnown) {
      if (content.includes(`<${icon}`)) {
        const hasImport = new RegExp(`import\\s*\\{[^}]*\\b${icon}\\b[^}]*\\}\\s*from\\s*['"]lucide-react['"]`).test(content);
        if (!hasImport) {
          issues.push({ file: rel, rule: 'IMPORT_LUCIDE', message: `Uses <${icon}> but does not import ${icon} from "lucide-react"` });
        }
      }
    }
  }
}

function auditButtonsHaveOnClick() {
  const files = getAllTsTsx(SRC).filter((f) => f.endsWith('.tsx'));
  for (const filePath of files) {
    const content = readFile(filePath);
    const rel = path.relative(process.cwd(), filePath);
    // Submit button in form with onSubmit is valid
    if (content.includes('<button') && !content.includes('onClick') && !(content.includes('type="submit"') && content.includes('onSubmit'))) {
      issues.push({ file: rel, rule: 'BUTTON_ONCLICK', message: 'File has <button> but no onClick handler' });
    }
  }
}

function auditAIRoutes() {
  const apiAi = path.join(SRC, 'app', 'api', 'ai');
  for (let n = 1; n <= 10; n++) {
    const routePath = path.join(apiAi, `flow${n}`, 'route.ts');
    if (!fs.existsSync(routePath)) continue;
    const content = readFile(routePath);
    const rel = path.relative(process.cwd(), routePath);
    if (!content.includes('try') || !content.includes('catch')) {
      issues.push({ file: rel, rule: 'AI_ERROR_HANDLING', message: 'AI route should wrap in try/catch' });
    }
    if (!content.includes('parseAIJSON') && (content.includes('JSON.parse') || content.includes('callClaude'))) {
      issues.push({ file: rel, rule: 'AI_PARSE_JSON', message: 'AI route should use parseAIJSON for response' });
    }
  }
}

function auditHardcodedFakeData() {
  const files = getAllTsTsx(SRC);
  for (const filePath of files) {
    const content = readFile(filePath);
    const rel = path.relative(process.cwd(), filePath);
    if (/"50 orders"|'50 orders'|92%|8\.5\/100/.test(content)) {
      issues.push({ file: rel, rule: 'FAKE_DATA', message: 'Possible hardcoded fake metric' });
    }
  }
}

function runAudit() {
  report.push('=== PMF Machine Audit ===\n');
  auditFileExists();
  auditUseClientAndImports();
  auditButtonsHaveOnClick();
  auditAIRoutes();
  auditHardcodedFakeData();

  report.push(`Total issues: ${issues.length}\n`);
  for (const i of issues) {
    report.push(`[${i.rule}] ${i.file}: ${i.message}`);
  }
  const out = report.join('\n');
  const outPath = path.join(process.cwd(), 'scripts', 'audit-report.txt');
  fs.writeFileSync(outPath, out, 'utf-8');
  console.log(out);
  return issues;
}

runAudit();
