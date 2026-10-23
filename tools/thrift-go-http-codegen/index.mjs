#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");
const CONTRACTS_DIR = path.join(ROOT_DIR, "contracts");
const TPL_FILE = path.join(CONTRACTS_DIR, "tpl/hz_package.yaml");

const HTTP_IDL_TARGETS = [
  {
    idl: "game/http_empire.thrift",
    outDir: "gen/game/hertz_gen/game/empire",
  },
];

const HTTP_ANNOTATION_METHODS = [
  ["api.get", "GET"],
  ["api.post", "POST"],
  ["api.patch", "PATCH"],
  ["api.put", "PUT"],
  ["api.delete", "DELETE"],
];

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function parseAnnotations(raw) {
  const annotations = {};
  if (!raw) return annotations;
  const regex = /([a-zA-Z0-9_.]+)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    annotations[match[1]] = match[2].replace(/\\"/g, '"');
  }
  return annotations;
}

function splitTrailingAnnotations(line) {
  const trimmed = line.replace(/[,;]\s*$/, "").trim();
  if (!trimmed.endsWith(")")) {
    return { declaration: trimmed, annotations: {} };
  }
  let depth = 0;
  let inQuotes = false;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const ch = trimmed[i];
    const prev = i > 0 ? trimmed[i - 1] : "";
    if (ch === '"' && prev !== "\\") {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ")") depth++;
    else if (ch === "(") {
      depth--;
      if (depth === 0) {
        return {
          declaration: trimmed.slice(0, i).trim(),
          annotations: parseAnnotations(trimmed.slice(i + 1, -1)),
        };
      }
    }
  }
  return { declaration: trimmed, annotations: {} };
}

function toMuxPattern(httpMethod, routePath) {
  const muxPath = routePath.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
  return `${httpMethod} ${muxPath}`;
}

function toServerAliasName(serviceName) {
  if (serviceName.endsWith("Service")) {
    return `${serviceName.slice(0, -7)}Server`;
  }
  return `${serviceName}Server`;
}

function toGoFieldName(name) {
  if (name === "id") return "ID";
  if (name === "url") return "URL";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function parseStructs(clean, filename) {
  const structs = {};
  const structRegex = /struct\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = structRegex.exec(clean)) !== null) {
    const structName = match[1];
    const body = match[2];
    const fields = [];
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const { declaration, annotations } = splitTrailingAnnotations(line);
      const fieldMatch =
        /^(\d+)\s*:\s*(?:(required|optional)\s+)?(.+?)\s+([a-zA-Z_][a-zA-Z0-9_]*)$/.exec(
          declaration,
        );
      if (!fieldMatch) {
        throw new Error(
          `Failed to parse struct field in ${filename} (${structName}): ${rawLine}`,
        );
      }
      const [, , reqOpt, fieldType, fieldName] = fieldMatch;
      fields.push({
        name: fieldName,
        goName: toGoFieldName(fieldName),
        type: fieldType.trim(),
        optional: reqOpt === "optional",
        annotations,
      });
    }
    structs[structName] = { name: structName, fields };
  }
  return structs;
}

function parseServiceRoutes(raw, filename) {
  const clean = stripComments(raw);
  const nsMatch = /^\s*namespace\s+go\s+([a-zA-Z0-9_.]+)/m.exec(clean);
  const namespace = nsMatch ? nsMatch[1] : "generated";
  const pkgParts = namespace.split(".");
  const pkgName = pkgParts[pkgParts.length - 1];
  const structs = parseStructs(clean, filename);

  const services = [];
  const serviceRegex = /service\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\{([\s\S]*?)\}/g;
  let serviceMatch;
  while ((serviceMatch = serviceRegex.exec(clean)) !== null) {
    const serviceName = serviceMatch[1];
    const body = serviceMatch[2];
    const methods = [];
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const { declaration, annotations } = splitTrailingAnnotations(line);
      const methodMatch =
        /^([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\d+\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\)$/.exec(
          declaration,
        );
      if (!methodMatch) {
        throw new Error(
          `Failed to parse service method in ${filename} (${serviceName}): ${rawLine}`,
        );
      }
      const [, responseType, methodName, requestType] = methodMatch;
      let httpMethod = null;
      let routePath = null;
      for (const [annotationKey, verb] of HTTP_ANNOTATION_METHODS) {
        if (annotations[annotationKey]) {
          httpMethod = verb;
          routePath = annotations[annotationKey];
          break;
        }
      }
      if (httpMethod && routePath) {
        methods.push({
          name: methodName,
          httpMethod,
          path: routePath,
          muxPattern: toMuxPattern(httpMethod, routePath),
          requestType,
          responseType,
          status: annotations["api.status"] || null,
        });
      }
    }
    services.push({
      name: serviceName,
      serverAlias: toServerAliasName(serviceName),
      methods,
    });
  }
  return { pkgName, namespace, structs, services };
}

function renderRouterGo({ pkgName, idl, structs, services }) {
  const lines = [
    `// Code generated by tools/thrift-go-http-codegen from contracts/${idl} (template: contracts/tpl/hz_package.yaml). DO NOT EDIT.`,
    "",
    `package ${pkgName}`,
    "",
    'import "net/http"',
    "",
    "// HTTPResponder abstracts stateless request binding and domain error serialization (implemented by httpx.Responder).",
    "type HTTPResponder interface {",
    "\tDecodeRequest(w http.ResponseWriter, r *http.Request, dst any) error",
    "\tWriteBindErrorHTTP(w http.ResponseWriter, r *http.Request, err error)",
    "\tWriteDomainErrorHTTP(w http.ResponseWriter, r *http.Request, err error)",
    "\tWriteOKHTTP(w http.ResponseWriter, r *http.Request, status int, resp any)",
    "}",
    "",
    "// HTTPRouteMiddleware optionally wraps generated per-route handlers (e.g. authentication/CSRF middleware).",
    "type HTTPRouteMiddleware interface {",
    "\tWrapRoute(route RouteSpec, next http.HandlerFunc) http.HandlerFunc",
    "}",
    "",
    "// RouteSpec describes a single HTTP/WebSocket endpoint declared in the Thrift IDL.",
    "type RouteSpec struct {",
    "\tName         string",
    "\tMethod       string",
    "\tPath         string",
    "\tMuxPattern   string",
    "\tRequestType  string",
    "\tResponseType string",
    "}",
    "",
  ];

  for (const svc of services) {
    lines.push(
      `// ${svc.serverAlias} is the stateless Clean DDD HTTP server interface generated from ${svc.name}.`,
    );
    lines.push(`type ${svc.serverAlias} = ${svc.name}`);
    lines.push("");

    lines.push(`// ${svc.name} route pattern constants generated from contracts/${idl}.`);
    lines.push("const (");
    for (const m of svc.methods) {
      lines.push(`\tPattern${m.name} = ${JSON.stringify(m.muxPattern)}`);
    }
    lines.push(")");
    lines.push("");

    lines.push(`// ${svc.name}Routes lists all ${svc.methods.length} route specifications declared on ${svc.name}.`);
    lines.push(`var ${svc.name}Routes = []RouteSpec{`);
    for (const m of svc.methods) {
      lines.push(
        `\t{Name: ${JSON.stringify(m.name)}, Method: ${JSON.stringify(m.httpMethod)}, Path: ${JSON.stringify(m.path)}, MuxPattern: Pattern${m.name}, RequestType: ${JSON.stringify(m.requestType)}, ResponseType: ${JSON.stringify(m.responseType)}},`,
      );
    }
    lines.push("}");
    lines.push("");

    lines.push(
      `// ${svc.name}RouteHandlers binds every endpoint in ${svc.name} to an http.HandlerFunc.`,
    );
    lines.push(`type ${svc.name}RouteHandlers struct {`);
    for (const m of svc.methods) {
      lines.push(`\t${m.name} http.HandlerFunc`);
    }
    lines.push("}");
    lines.push("");

    lines.push(
      `// Register${svc.name}Routes registers all ${svc.name} endpoints on mux and panics if any IDL endpoint handler is nil.`,
    );
    lines.push(
      `func Register${svc.name}Routes(mux *http.ServeMux, h ${svc.name}RouteHandlers) {`,
    );
    for (const m of svc.methods) {
      lines.push(`\tif h.${m.name} == nil {`);
      lines.push(
        `\t\tpanic("${svc.name}RouteHandlers.${m.name} (" + Pattern${m.name} + ") is nil")`,
      );
      lines.push("\t}");
      lines.push(`\tmux.HandleFunc(Pattern${m.name}, h.${m.name})`);
    }
    lines.push("}");
    lines.push("");

    lines.push(
      `// Register${svc.serverAlias} binds ${svc.serverAlias} methods using HTTPResponder with optional per-route handler overrides.`,
    );
    lines.push(
      `func Register${svc.serverAlias}(mux *http.ServeMux, srv ${svc.serverAlias}, m HTTPResponder, overrides ...${svc.name}RouteHandlers) {`,
    );
    lines.push(`\tvar h ${svc.name}RouteHandlers`);
    lines.push("\tif len(overrides) > 0 {");
    lines.push("\t\th = overrides[0]");
    lines.push("\t}");
    lines.push("\tmw, hasMW := m.(HTTPRouteMiddleware)");
    for (const m of svc.methods) {
      const reqStruct = structs[m.requestType] || { fields: [] };
      const hasBodyFields = reqStruct.fields.some(
        (f) => f.annotations["api.body"] !== undefined,
      );
      const pathFields = reqStruct.fields.filter(
        (f) => f.annotations["api.path"] !== undefined,
      );
      const queryFields = reqStruct.fields.filter(
        (f) => f.annotations["api.query"] !== undefined,
      );
      const headerFields = reqStruct.fields.filter(
        (f) => f.annotations["api.header"] !== undefined,
      );
      const okStatus =
        m.status === "201"
          ? "http.StatusCreated"
          : m.responseType === "EmptyResp"
            ? "http.StatusNoContent"
            : "http.StatusOK";
      lines.push(`\tif h.${m.name} == nil {`);
      lines.push(`\t\tfn := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {`);
      lines.push(`\t\t\tvar req ${m.requestType}`);
      if (hasBodyFields) {
        lines.push("\t\t\tif err := m.DecodeRequest(w, r, &req); err != nil {");
        lines.push("\t\t\t\tm.WriteBindErrorHTTP(w, r, err)");
        lines.push("\t\t\t\treturn");
        lines.push("\t\t\t}");
      }
      for (const pf of pathFields) {
        const key = JSON.stringify(pf.annotations["api.path"]);
        if (pf.optional) {
          lines.push(`\t\t\tif v := r.PathValue(${key}); v != "" {`);
          lines.push(`\t\t\t\treq.${pf.goName} = &v`);
          lines.push("\t\t\t}");
        } else {
          lines.push(`\t\t\treq.${pf.goName} = r.PathValue(${key})`);
        }
      }
      if (queryFields.length > 0) {
        lines.push("\t\t\tq := r.URL.Query()");
        for (const qf of queryFields) {
          const key = JSON.stringify(qf.annotations["api.query"]);
          if (qf.optional) {
            lines.push(`\t\t\tif v := q.Get(${key}); v != "" {`);
            lines.push(`\t\t\t\treq.${qf.goName} = &v`);
            lines.push("\t\t\t}");
          } else {
            lines.push(`\t\t\treq.${qf.goName} = q.Get(${key})`);
          }
        }
      }
      for (const hf of headerFields) {
        const key = JSON.stringify(hf.annotations["api.header"]);
        if (hf.optional) {
          lines.push(`\t\t\tif v := r.Header.Get(${key}); v != "" {`);
          lines.push(`\t\t\t\treq.${hf.goName} = &v`);
          lines.push("\t\t\t}");
        } else {
          lines.push(`\t\t\treq.${hf.goName} = r.Header.Get(${key})`);
        }
      }
      if (m.responseType === "EmptyResp") {
        lines.push(`\t\t\t_, err := srv.${m.name}(r.Context(), &req)`);
        lines.push("\t\t\tif err != nil {");
        lines.push("\t\t\t\tm.WriteDomainErrorHTTP(w, r, err)");
        lines.push("\t\t\t\treturn");
        lines.push("\t\t\t}");
        lines.push(`\t\t\tm.WriteOKHTTP(w, r, ${okStatus}, nil)`);
      } else {
        lines.push(`\t\t\tresp, err := srv.${m.name}(r.Context(), &req)`);
        lines.push("\t\t\tif err != nil {");
        lines.push("\t\t\t\tm.WriteDomainErrorHTTP(w, r, err)");
        lines.push("\t\t\t\treturn");
        lines.push("\t\t\t}");
        lines.push(`\t\t\tm.WriteOKHTTP(w, r, ${okStatus}, resp)`);
      }
      lines.push("\t\t})");
      lines.push("\t\tif hasMW {");
      lines.push(
        `\t\t\tfn = mw.WrapRoute(RouteSpec{Name: ${JSON.stringify(m.name)}, Method: ${JSON.stringify(m.httpMethod)}, Path: ${JSON.stringify(m.path)}, MuxPattern: Pattern${m.name}, RequestType: ${JSON.stringify(m.requestType)}, ResponseType: ${JSON.stringify(m.responseType)}}, fn)`,
      );
      lines.push("\t\t}");
      lines.push(`\t\th.${m.name} = fn`);
      lines.push("\t}");
    }
    lines.push(`\tRegister${svc.name}Routes(mux, h)`);
    lines.push("}");
    lines.push("");
  }

  return lines.join("\n");
}

if (!fs.existsSync(TPL_FILE)) {
  console.error(`Missing template metadata file: ${TPL_FILE}`);
  process.exit(1);
}

for (const target of HTTP_IDL_TARGETS) {
  const idlPath = path.join(CONTRACTS_DIR, target.idl);
  const raw = fs.readFileSync(idlPath, "utf8");
  const parsed = parseServiceRoutes(raw, target.idl);
  const rendered = renderRouterGo({ ...parsed, idl: target.idl });
  const outFile = path.join(CONTRACTS_DIR, target.outDir, "router_gen.go");
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : "";
    if (current !== rendered) {
      console.error(`${outFile} is out of date with contracts/${target.idl}.`);
      process.exit(1);
    }
  } else {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, rendered, "utf8");
  }
}
