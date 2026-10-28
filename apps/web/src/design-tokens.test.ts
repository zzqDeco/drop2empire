import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ICON } from "./icons";

const srcDir = dirname(fileURLToPath(import.meta.url));

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full));
    } else {
      results.push(relative(srcDir, full));
    }
  }
  return results;
}

const allRelFiles = collectFiles(srcDir);
const styleCssFiles = [
  "styles.css",
  "styles/shell.css",
  "styles/settlement.css",
  "styles/raid.css",
  "styles/macro.css",
  "styles/admin.css",
];
const allCssFiles = ["tokens.css", "layout.css", ...styleCssFiles];

function parseHex(hex: string) {
  const clean = hex.replace("#", "").trim().toLowerCase();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

function srgbToLinear(channel: number) {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(rgb: { r: number; g: number; b: number }) {
  return (
    0.2126 * srgbToLinear(rgb.r) +
    0.7152 * srgbToLinear(rgb.g) +
    0.0722 * srgbToLinear(rgb.b)
  );
}

function contrastRatio(hexA: string, hexB: string) {
  const a = parseHex(hexA)!;
  const b = parseHex(hexB)!;
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("Blueprint & Ink design tokens & WCAG AA contrast", () => {
  const tokensCss = readFileSync(join(srcDir, "tokens.css"), "utf8");
  const lightBlock = /:root\s*\{([\s\S]*?)\}/.exec(tokensCss)?.[1] || "";
  const darkBlock =
    /:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/.exec(tokensCss)?.[1] || "";

  const lightTokenMap = new Map<string, string>();
  for (const match of lightBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    lightTokenMap.set(match[1], match[2].trim());
  }

  const darkTokenMap = new Map<string, string>(lightTokenMap);
  for (const match of darkBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    darkTokenMap.set(match[1], match[2].trim());
  }

  it("defines complete color, surface, typography, radius, shadow, and spacing tokens", () => {
    const required = [
      "--text-strong",
      "--text",
      "--text-muted",
      "--text-subtle",
      "--brand",
      "--brand-muted",
      "--brand-text",
      "--brand-strong",
      "--info-text",
      "--info-bg",
      "--info-border",
      "--backdrop-overlay",
      "--focus-ring",
      "--font-sans",
      "--font-mono",
      "--bg",
      "--surface",
      "--surface-sunken",
      "--rail",
      "--ink-wash",
      "--border",
      "--border-strong",
      "--r-xs",
      "--r-sm",
      "--r-md",
      "--r-lg",
      "--r-xl",
      "--r-pill",
      "--shadow-sm",
      "--shadow-md",
      "--shadow-lg",
      "--shadow-pop",
      "--space-1",
      "--space-2",
      "--space-3",
      "--space-4",
      "--space-5",
      "--space-6",
      "--space-8",
      "--space-12",
    ];
    for (const name of required) {
      expect(lightTokenMap.has(name), `missing light token ${name}`).toBe(true);
      expect(darkTokenMap.has(name), `missing dark token ${name}`).toBe(true);
    }
    expect(tokensCss).toContain("font-family: var(--font-sans);");
    expect(tokensCss).toContain("color: var(--text-strong);");
    expect(tokensCss).toContain("background: var(--bg);");
    expect(tokensCss).toContain("font-size: var(--font-md);");
  });

  it("ensures every text token meets WCAG AA >= 4.5:1 across all light surfaces", () => {
    const surfaces = [
      lightTokenMap.get("--surface")!,
      lightTokenMap.get("--bg")!,
      lightTokenMap.get("--surface-sunken")!,
      lightTokenMap.get("--rail")!,
    ];
    const textTokens = [
      "--text-strong",
      "--text",
      "--text-muted",
      "--text-subtle",
      "--brand-text",
      "--brand-strong",
      "--danger-text",
      "--warning-text",
      "--success-text",
      "--info-text",
    ];
    for (const token of textTokens) {
      const fg = lightTokenMap.get(token)!;
      for (const bg of surfaces) {
        expect(
          contrastRatio(fg, bg),
          `light ${token} (${fg}) on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(
      contrastRatio(
        lightTokenMap.get("--brand")!,
        lightTokenMap.get("--on-brand")!,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("ensures every text token meets WCAG AA >= 4.5:1 across all dark surfaces", () => {
    const surfaces = [
      darkTokenMap.get("--surface")!,
      darkTokenMap.get("--bg")!,
      darkTokenMap.get("--surface-sunken")!,
      darkTokenMap.get("--rail")!,
    ];
    const textTokens = [
      "--text-strong",
      "--text",
      "--text-muted",
      "--text-subtle",
      "--brand-text",
      "--brand-strong",
      "--danger-text",
      "--warning-text",
      "--success-text",
      "--info-text",
    ];
    for (const token of textTokens) {
      const fg = darkTokenMap.get(token)!;
      for (const bg of surfaces) {
        expect(
          contrastRatio(fg, bg),
          `dark ${token} (${fg}) on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(
      contrastRatio(
        darkTokenMap.get("--brand")!,
        darkTokenMap.get("--on-brand")!,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies all referenced var(--*) tokens are defined in tokens.css or dynamic local properties", () => {
    const dynamicCssVars = new Set([
      "--rot-x",
      "--rot-y",
      "--shine-deg",
      "--emblem-deg",
      "--etch-x",
      "--etch-y",
      "--progress-pct",
      "--burst-x",
      "--burst-y",
      "--anim-delay",
    ]);
    const targetFiles = allRelFiles.filter(
      (f) =>
        (f.endsWith(".css") || f.endsWith(".tsx")) && !f.endsWith(".test.tsx"),
    );
    const undefinedVars: string[] = [];
    for (const file of targetFiles) {
      const content = readFileSync(join(srcDir, file), "utf8");
      for (const match of content.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)) {
        const varName = match[1];
        if (!lightTokenMap.has(varName) && !dynamicCssVars.has(varName)) {
          undefinedVars.push(`${file}:${varName}`);
        }
      }
    }
    expect(undefinedVars, "Undefined CSS custom properties").toEqual([]);
  });

  it("prohibits hardcoded #hex and rgb()/rgba() colors outside tokens.css and theme/svgPalettes.ts", () => {
    const allowedColorFiles = new Set(["tokens.css", "theme/svgPalettes.ts"]);
    const targetFiles = allRelFiles.filter(
      (f) =>
        (f.endsWith(".css") || f.endsWith(".ts") || f.endsWith(".tsx")) &&
        !f.endsWith(".test.ts") &&
        !f.endsWith(".test.tsx") &&
        !allowedColorFiles.has(f),
    );
    const violations: string[] = [];
    for (const file of targetFiles) {
      const content = readFileSync(join(srcDir, file), "utf8");
      for (const match of content.matchAll(
        /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/g,
      )) {
        violations.push(`${file}:${match[0]}`);
      }
    }
    expect(violations, "Hardcoded colors outside token/palette files").toEqual(
      [],
    );
  });

  it("prohibits inline style={{ attributes in .tsx files", () => {
    const tsxFiles = allRelFiles.filter(
      (f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"),
    );
    const violations: string[] = [];
    for (const file of tsxFiles) {
      const content = readFileSync(join(srcDir, file), "utf8");
      if (content.includes("style={{")) {
        violations.push(file);
      }
    }
    expect(violations, "Inline style={{ attributes found in TSX").toEqual([]);
  });

  it("enforces tabular-nums monospace rule for numeric alignment", () => {
    const stylesCss = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(stylesCss).toContain("font-family: var(--font-mono);");
    expect(stylesCss).toContain("font-variant-numeric: tabular-nums;");
  });

  it("eliminates sub-11px and fractional font sizes, non-standard font weights, and non-motion !important rules", () => {
    for (const file of allCssFiles) {
      const content = readFileSync(join(srcDir, file), "utf8");
      for (const match of content.matchAll(/font-size\s*:\s*([^;}\n]+)/gi)) {
        const pxMatch = /^(\d+(?:\.\d+)?)px/.exec(match[1].trim());
        if (pxMatch) {
          const px = Number(pxMatch[1]);
          expect(px, `${file}: font-size ${match[1]}`).toBeGreaterThanOrEqual(
            11,
          );
          expect(
            Number.isInteger(px),
            `${file}: fractional font-size ${match[1]}`,
          ).toBe(true);
        }
      }
      for (const match of content.matchAll(/font-weight\s*:\s*(\d+)/gi)) {
        const weight = Number(match[1]);
        expect(
          [400, 500, 600, 700].includes(weight),
          `${file}: non-standard font-weight ${weight}`,
        ).toBe(true);
      }
      if (file !== "tokens.css") {
        expect(content, `${file} should have no !important`).not.toContain(
          "!important",
        );
      }
    }
  });

  it("contains zero unreferenced CSS classes in styles.css and styles/*.css", () => {
    const tsFiles = allRelFiles.filter(
      (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
    );
    let corpus =
      readFileSync(join(srcDir, "..", "index.html"), "utf8") + "\n";
    for (const f of tsFiles) {
      corpus += readFileSync(join(srcDir, f), "utf8") + "\n";
    }
    // Dynamic prefix classes constructed via template strings
    const dynamicAllowlist = new Set([
      "war-owner-obsidian",
      "war-owner-argent",
      "war-owner-neutral",
      "rarity-common",
      "rarity-rare",
      "rarity-epic",
      "rarity-legendary",
    ]);
    for (const cssFile of styleCssFiles) {
      const content = readFileSync(join(srcDir, cssFile), "utf8");
      const classes = new Set<string>();
      for (const m of content.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)) {
        classes.add(m[1]);
      }
      const unreferenced = [...classes].filter(
        (cls) => !dynamicAllowlist.has(cls) && !corpus.includes(cls),
      );
      expect(unreferenced, `${cssFile} unreferenced classes`).toEqual([]);
    }

    // Reverse check: every static className used in .tsx must be defined in styles.css or styles/*.css
    const fullCss = styleCssFiles
      .map((f) => readFileSync(join(srcDir, f), "utf8"))
      .join("\n");
    const definedClasses = new Set<string>();
    for (const m of fullCss.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)) {
      definedClasses.add(m[1]);
    }
    const tsxFiles = allRelFiles.filter((f) => f.endsWith(".tsx"));
    const undefinedInCss: string[] = [];
    for (const f of tsxFiles) {
      const content = readFileSync(join(srcDir, f), "utf8");
      for (const m of content.matchAll(
        /className=(?:"([^"]+)"|\{`([^`]+)`\})/g,
      )) {
        const raw = (m[1] || m[2] || "").replace(/\$\{[^}]+\}/g, " ");
        for (const cls of raw.split(/\s+/).filter(Boolean)) {
          if (!cls.endsWith("-") && !definedClasses.has(cls)) {
            undefinedInCss.push(`${f}:${cls}`);
          }
        }
      }
    }
    expect(undefinedInCss, "TSX classes missing from CSS").toEqual([]);
  });

  it("standardizes Lucide icon sizes onto ICON scale {14, 16, 18, 20, 24}", () => {
    expect(ICON).toEqual({
      xs: 14,
      sm: 16,
      md: 18,
      lg: 20,
      xl: 24,
    });
    const tsxFiles = allRelFiles.filter(
      (f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"),
    );
    for (const file of tsxFiles) {
      const content = readFileSync(join(srcDir, file), "utf8");
      expect(
        [...content.matchAll(/size=\{\d+\}/g)],
        `${file} raw numeric icon size`,
      ).toEqual([]);
    }
  });
});
