// dev-server-setup.js
// Dev server middleware configuration for visual editing
const fs = require("fs");
const path = require("path");
const express = require("express");
const { execSync } = require("child_process");

// ───────────────────────────────────────────────────────────────────────────────
// Variable Edit Handler - For editing dynamic content from traceable sources
// ───────────────────────────────────────────────────────────────────────────────

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

/**
 * Resolves an import path to an absolute file path
 * @param {string} source - Import source (e.g., "@/data/products" or "./utils")
 * @param {string} frontendRoot - Root directory of the frontend
 * @returns {string|null} Absolute path or null if not found
 */
function resolveSourceFile(source, frontendRoot) {
  let base;

  if (source.startsWith("@/")) {
    base = path.join(frontendRoot, "src", source.slice(2));
  } else if (source.startsWith("./") || source.startsWith("../")) {
    base = path.resolve(frontendRoot, "src", source);
  } else {
    return null; // External package
  }

  // Try direct file with extensions
  for (const ext of EXTENSIONS) {
    const file = base.endsWith(ext) ? base : base + ext;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      return file;
    }
  }

  // Try index file in directory
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of EXTENSIONS) {
      const indexFile = path.join(base, "index" + ext);
      if (fs.existsSync(indexFile)) {
        return indexFile;
      }
    }
  }

  return null;
}

/**
 * Validates if a variable edit request is valid and safe
 * @param {Object} change - The change request
 * @returns {{valid: boolean, error?: string}}
 */
function validateVariableEdit(change) {
  if (!change.variableName) {
    return { valid: false, error: "Missing variableName" };
  }

  if (change.newValue === undefined) {
    return { valid: false, error: "Missing newValue" };
  }

  // Prevent code injection - only allow primitive values
  if (typeof change.newValue === "string") {
    // Disallow strings that look like code
    if (change.newValue.includes("${") || change.newValue.includes("`")) {
      return { valid: false, error: "Template literals not allowed in newValue" };
    }
  }

  return { valid: true };
}

/**
 * Processes a variable edit request
 * @param {Object} change - The change request with sourceFile, variableName, etc.
 * @param {string} frontendRoot - Root directory of the frontend
 * @param {Object} babelTools - { parser, traverse, generate, t }
 * @returns {{success: boolean, file?: string, error?: string}}
 */
function processVariableEdit(change, frontendRoot, babelTools) {
  const { parser, traverse, generate, t } = babelTools;

  // Resolve the source file
  // Prefer absolute path (sourceFileAbs) if provided, otherwise resolve from sourceFile
  let targetFile;
  if (change.sourceFileAbs) {
    // Use absolute path directly
    targetFile = change.sourceFileAbs;
  } else if (change.sourceFile) {
    targetFile = resolveSourceFile(change.sourceFile, frontendRoot);
    if (!targetFile) {
      return { success: false, error: `Could not resolve source file: ${change.sourceFile}` };
    }
  } else {
    return { success: false, error: "sourceFile or sourceFileAbs is required for variableEdit" };
  }

  // Security check
  const normalizedTarget = path.normalize(targetFile);
  if (!normalizedTarget.startsWith(frontendRoot) || normalizedTarget.includes("node_modules")) {
    return { success: false, error: `Forbidden path: ${targetFile}` };
  }

  // Read and parse the file
  if (!fs.existsSync(targetFile)) {
    return { success: false, error: `File not found: ${targetFile}` };
  }

  const content = fs.readFileSync(targetFile, "utf8");
  let ast;
  try {
    ast = parser.parse(content, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
  } catch (parseError) {
    return { success: false, error: `Parse error: ${parseError.message}` };
  }

  // Find and modify the variable
  let modified = false;
  let oldValue = null;

  traverse(ast, {
    VariableDeclarator(nodePath) {
      // Match by name and optionally by line
      if (!t.isIdentifier(nodePath.node.id)) return;
      if (nodePath.node.id.name !== change.variableName) return;

      // If line is specified, verify it matches
      if (change.variableLine && nodePath.node.loc?.start.line !== change.variableLine) {
        return;
      }

      const init = nodePath.node.init;
      if (!init) return;

      // Handle different value types
      if (change.arrayIndex !== undefined) {
        // Array element modification
        if (!t.isArrayExpression(init)) {
          return;
        }

        const elements = init.elements;
        if (change.arrayIndex < 0 || change.arrayIndex >= elements.length) {
          return;
        }

        const element = elements[change.arrayIndex];
        if (!element) return;

        if (change.propertyPath) {
          // Modify property within array element (e.g., PRODUCTS[1].name)
          if (!t.isObjectExpression(element)) {
            return;
          }

          const result = modifyObjectProperty(element, change.propertyPath, change.newValue, t);
          if (result.success) {
            oldValue = result.oldValue;
            modified = true;
          }
        } else {
          // Replace entire array element
          oldValue = generate(element).code;
          if (typeof change.newValue === "string") {
            elements[change.arrayIndex] = t.stringLiteral(change.newValue);
          } else if (typeof change.newValue === "number") {
            elements[change.arrayIndex] = t.numericLiteral(change.newValue);
          } else if (typeof change.newValue === "object") {
            // For objects, parse the JSON and create an object expression
            elements[change.arrayIndex] = jsonToAst(change.newValue, t);
          }
          modified = true;
        }
      } else if (change.propertyPath) {
        // Object property modification (e.g., CONFIG.title)
        if (!t.isObjectExpression(init)) {
          return;
        }

        const result = modifyObjectProperty(init, change.propertyPath, change.newValue, t);
        if (result.success) {
          oldValue = result.oldValue;
          modified = true;
        }
      } else {
        // Direct value replacement
        if (t.isStringLiteral(init)) {
          oldValue = init.value;
          init.value = String(change.newValue);
          modified = true;
        } else if (t.isNumericLiteral(init)) {
          oldValue = init.value;
          init.value = Number(change.newValue);
          modified = true;
        }
      }

      if (modified) {
        nodePath.stop();
      }
    },
  });

  if (!modified) {
    return { success: false, error: `Variable "${change.variableName}" not found or not editable` };
  }

  // Generate updated code
  const { code } = generate(ast, {
    retainLines: true,
    retainFunctionParens: true,
    comments: true,
  });

  // Write the file
  fs.writeFileSync(targetFile, code, "utf8");

  return {
    success: true,
    file: targetFile,
    oldValue,
    newValue: change.newValue,
  };
}

/**
 * Modifies a property within an ObjectExpression
 * @param {Object} objectExpr - The ObjectExpression AST node
 * @param {string} propertyPath - Dot-notation path (e.g., "name" or "address.city")
 * @param {*} newValue - The new value to set
 * @param {Object} t - Babel types
 * @returns {{success: boolean, oldValue?: string}}
 */
function modifyObjectProperty(objectExpr, propertyPath, newValue, t) {
  const parts = propertyPath.split(".");
  let current = objectExpr;

  // Navigate to the parent of the target property
  for (let i = 0; i < parts.length - 1; i++) {
    const prop = findProperty(current, parts[i], t);
    if (!prop || !t.isObjectExpression(prop.value)) {
      return { success: false };
    }
    current = prop.value;
  }

  // Find and modify the target property
  const targetPropName = parts[parts.length - 1];
  const targetProp = findProperty(current, targetPropName, t);

  if (!targetProp) {
    return { success: false };
  }

  let oldValue;
  if (t.isStringLiteral(targetProp.value)) {
    oldValue = targetProp.value.value;
    targetProp.value = t.stringLiteral(String(newValue));
    return { success: true, oldValue };
  } else if (t.isNumericLiteral(targetProp.value)) {
    oldValue = targetProp.value.value;
    targetProp.value = t.numericLiteral(Number(newValue));
    return { success: true, oldValue };
  }

  return { success: false };
}

/**
 * Finds a property in an ObjectExpression by name
 */
function findProperty(objectExpr, propName, t) {
  if (!t.isObjectExpression(objectExpr)) return null;

  for (const prop of objectExpr.properties) {
    if (t.isObjectProperty(prop)) {
      if (t.isIdentifier(prop.key) && prop.key.name === propName) {
        return prop;
      }
      if (t.isStringLiteral(prop.key) && prop.key.value === propName) {
        return prop;
      }
    }
  }
  return null;
}

/**
 * Converts a JSON value to an AST node
 */
function jsonToAst(value, t) {
  if (value === null) {
    return t.nullLiteral();
  }
  if (typeof value === "string") {
    return t.stringLiteral(value);
  }
  if (typeof value === "number") {
    return t.numericLiteral(value);
  }
  if (typeof value === "boolean") {
    return t.booleanLiteral(value);
  }
  if (Array.isArray(value)) {
    return t.arrayExpression(value.map(v => jsonToAst(v, t)));
  }
  if (typeof value === "object") {
    return t.objectExpression(
      Object.entries(value).map(([k, v]) =>
        t.objectProperty(t.identifier(k), jsonToAst(v, t))
      )
    );
  }
  return t.nullLiteral();
}

// 🔍 Read Supervisor code-server password from conf.d
function getCodeServerPassword() {
  try {
    const conf = fs.readFileSync(
      "/etc/supervisor/conf.d/supervisord_code_server.conf",
      "utf8",
    );

    // Match environment=PASSWORD="value"
    const match = conf.match(/PASSWORD="([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

const SUP_PASS = getCodeServerPassword();

// Dev server setup function
function setupDevServer(config) {
  config.setupMiddlewares = (middlewares, devServer) => {
    if (!devServer) throw new Error("webpack-dev-server not defined");
    devServer.app.use(express.json());

    // CORS origin validation
    const isAllowedOrigin = (origin) => {
      if (!origin) return false;

      // Allow localhost and 127.0.0.1 on any port
      if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
        return true;
      }

      // Allow all emergent.sh subdomains
      if (origin.match(/^https:\/\/([a-zA-Z0-9-]+\.)*emergent\.sh$/)) {
        return true;
      }

      // Allow all emergentagent.com subdomains
      if (origin.match(/^https:\/\/([a-zA-Z0-9-]+\.)*emergentagent\.com$/)) {
        return true;
      }

      // Allow all appspot.com subdomains (for App Engine)
      if (origin.match(/^https:\/\/([a-zA-Z0-9-]+\.)*appspot\.com$/)) {
        return true;
      }

      return false;
    };

    // ✅ Health check (no auth)
    devServer.app.get("/ping", (req, res) => {
      res.json({ status: "ok", time: new Date().toISOString() });
    });

    // ✅ Protected file editing endpoint with AST processing
    devServer.app.post("/edit-file", (req, res) => {
      // Validate and set CORS headers
      const origin = req.get("Origin");
      if (origin && isAllowedOrigin(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Headers", "Content-Type, x-api-key");
      }

      // 🔑 Check header against Supervisor password
      const key = req.get("x-api-key");
      if (!SUP_PASS || key !== SUP_PASS) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { changes } = req.body;

      if (!changes || !Array.isArray(changes) || changes.length === 0) {
        return res.status(400).json({ error: "No changes provided" });
      }

      try {
        // Track all edits for response
        const edits = [];
        const rejectedChanges = [];

        // Import Babel libraries (needed for both variableEdit and regular edits)
        const parser = require("@babel/parser");
        const traverse = require("@babel/traverse").default;
        const generate = require("@babel/generator").default;
        const t = require("@babel/types");
        const frontendRoot = path.resolve(__dirname, '../..');

        // Helper function to get consistent relative path
        const getRelativePath = (absolutePath) => {
          const rel = path.relative(frontendRoot, absolutePath);
          return '/' + rel;
        };

        // ═══════════════════════════════════════════════════════════════════════
        // Process variableEdit changes separately (they target data source files)
        // ═══════════════════════════════════════════════════════════════════════
        const variableEditChanges = changes.filter(c => c.type === "variableEdit");
        const otherChanges = changes.filter(c => c.type !== "variableEdit");

        for (const change of variableEditChanges) {
          console.log(`[backend] Processing variableEdit change:`, {
            sourceFile: change.sourceFile,
            variableName: change.variableName,
            arrayIndex: change.arrayIndex,
            propertyPath: change.propertyPath,
          });

          // Validate the change request
          const validation = validateVariableEdit(change);
          if (!validation.valid) {
            rejectedChanges.push({
              change,
              reason: validation.error,
            });
            continue;
          }

          // Process the variable edit
          const result = processVariableEdit(change, frontendRoot, {
            parser,
            traverse,
            generate,
            t,
          });

          if (result.success) {
            edits.push({
              file: getRelativePath(result.file),
              type: "variableEdit",
              variableName: change.variableName,
              arrayIndex: change.arrayIndex,
              propertyPath: change.propertyPath,
              oldData: result.oldValue,
              newData: result.newValue,
            });

            // Commit the change to git
            const timestamp = Date.now();
            try {
              execSync(`git -c user.name="visual-edit" -c user.email="maria.garcia@eniit.es" add "${result.file}"`);
              execSync(`git -c user.name="visual-edit" -c user.email="maria.garcia@eniit.es" commit -m "visual_edit_variable_${timestamp}"`);
            } catch (gitError) {
              console.error(`Git commit failed for variableEdit: ${gitError.message}`);
            }
          } else {
            rejectedChanges.push({
              change,
              reason: result.error,
            });
          }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Process regular JSX changes (className, textContent, content)
        // ═══════════════════════════════════════════════════════════════════════

        // Group changes by fileName
        const changesByFile = {};
        otherChanges.forEach((change) => {
          if (!changesByFile[change.fileName]) {
            changesByFile[change.fileName] = [];
          }
          changesByFile[change.fileName].push(change);
        });

        // Process each file's changes
        Object.entries(changesByFile).forEach(([fileName, fileChanges]) => {
          const findFileRecursive = (dir, filename) => {
            try {
              const files = fs.readdirSync(dir, { withFileTypes: true });

              for (const file of files) {
                const fullPath = path.join(dir, file.name);

                // Skip excluded directories
                if (file.isDirectory()) {
                  if (
                    file.name === "node_modules" ||
                    file.name === "public" ||
                    file.name === ".git" ||
                    file.name === "build" ||
                    file.name === "dist" ||
                    file.name === "coverage"
                  ) {
                    continue;
                  }
                  const found = findFileRecursive(fullPath, filename);
                  if (found) return found;
                } else if (file.isFile()) {
                  // Check if filename matches (basename without extension)
                  const fileBaseName = file.name.replace(
                    /\.(js|jsx|ts|tsx)$/,
                    "",
                  );
                  if (fileBaseName === filename) {
                    return fullPath;
                  }
                }
              }
            } catch (err) {
              // Ignore permission errors and continue
            }
            return null;
          };

          // Find the file
          let targetFile = findFileRecursive(frontendRoot, fileName);

          // If still not found, default to components path with .js for new files
          if (!targetFile) {
            targetFile = path.resolve(
              frontendRoot,
              "src/components",
              `${fileName}.js`,
            );
          }

          // Security check - prevent path traversal and restrict to frontend folder
          const normalizedTarget = path.normalize(targetFile);
          const isInFrontend =
            normalizedTarget.startsWith(frontendRoot) &&
            !normalizedTarget.includes("..");
          const isNodeModules = normalizedTarget.includes("node_modules");
          const isPublic =
            normalizedTarget.includes("/public/") ||
            normalizedTarget.endsWith("/public");

          if (!isInFrontend || isNodeModules || isPublic) {
            throw new Error(`Forbidden path for file ${fileName}`);
          }

          // Verify file exists before attempting to read
          if (!fs.existsSync(targetFile)) {
            throw new Error(`File not found: ${targetFile}`);
          }

          // Read the current file content
          const currentContent = fs.readFileSync(targetFile, "utf8");

          // Parse the JSX file
          const ast = parser.parse(currentContent, {
            sourceType: "module",
            plugins: ["jsx", "typescript"],
          });

          // Helper function to parse JSX children
          const parseJsxChildren = (content) => {
            if (content === undefined) {
              return null;
            }

            const sanitizeMetaAttributes = (node) => {
              if (t.isJSXElement(node)) {
                node.openingElement.attributes =
                  node.openingElement.attributes.filter((attr) => {
                    if (
                      t.isJSXAttribute(attr) &&
                      t.isJSXIdentifier(attr.name)
                    ) {
                      return !attr.name.name.startsWith("x-");
                    }
                    return true;
                  });

                node.children.forEach((child) =>
                  sanitizeMetaAttributes(child),
                );
              } else if (t.isJSXFragment(node)) {
                node.children.forEach((child) =>
                  sanitizeMetaAttributes(child),
                );
              }
            };

            try {
              const wrapperExpression = parser.parseExpression(
                `(<gjs-wrapper>${content}</gjs-wrapper>)`,
                {
                  sourceType: "module",
                  plugins: ["jsx", "typescript"],
                },
              );

              if (t.isJSXElement(wrapperExpression)) {
                const innerChildren = wrapperExpression.children || [];
                innerChildren.forEach((child) =>
                  sanitizeMetaAttributes(child),
                );
                return innerChildren;
              }
            } catch (parseError) {
              // Fallback to treating content as raw text if parsing fails
            }

            return [t.jsxText(content)];
          };

          // Create a map of changes by line number for this file (array of changes per line)
          const changesByLine = {};
          fileChanges.forEach((change) => {
            if (!changesByLine[change.lineNumber]) {
              changesByLine[change.lineNumber] = [];
            }
            changesByLine[change.lineNumber].push(change);
          });

          // Traverse and update AST using line numbers
          traverse(ast, {
            JSXOpeningElement: (path) => {
              const lineNumber = path.node.loc?.start.line;
              if (!lineNumber) return;

              const changesAtLine = changesByLine[lineNumber];
              if (!changesAtLine || changesAtLine.length === 0) return;

              // Verify this is the correct element by checking component type
              const elementName = path.node.name.name;

              // Process ALL changes for this line
              changesAtLine.forEach((change) => {
                if (elementName !== change.component) return;

                // FIXED: Conditional processing based on change type
                console.log(
                  `[backend] Processing change type: ${change.type || "legacy"} for element: ${elementName}`,
                );

                if (
                  change.type === "className" &&
                  change.className !== undefined
                ) {
                  // CLASSNAME/TAILWIND PROCESSING
                  console.log(
                    `[backend] Processing className change:`,
                    change.className,
                  );

                  // Find existing className attribute
                  let classAttr = path.node.attributes.find(
                    (attr) =>
                      t.isJSXAttribute(attr) &&
                      attr.name.name === "className",
                  );

                  // Capture old className value
                  const oldClassName = classAttr?.value?.value || "";

                  if (classAttr) {
                    // Update existing className
                    console.log(
                      `[backend] Updating existing className from:`,
                      classAttr.value?.value,
                      "to:",
                      change.className,
                    );
                    classAttr.value = t.stringLiteral(change.className);
                  } else {
                    // Create new className attribute
                    console.log(
                      `[backend] Creating new className attribute:`,
                      change.className,
                    );
                    const newClassAttr = t.jsxAttribute(
                      t.jsxIdentifier("className"),
                      t.stringLiteral(change.className),
                    );
                    path.node.attributes.push(newClassAttr);
                  }

                  // Track this edit
                  edits.push({
                    file: getRelativePath(targetFile),
                    lineNumber: lineNumber,
                    element: elementName,
                    type: "className",
                    oldData: oldClassName,
                    newData: change.className,
                  });
                } else if (
                  change.type === "textContent" &&
                  (Array.isArray(change.textParts) ||
                    change.textContent !== undefined)
                ) {
                  console.log(
                    `[backend] Processing textContent change:`,
                    change.textContent,
                  );

                  const parentElementPath = path.parentPath;
                  if (parentElementPath && parentElementPath.isJSXElement()) {
                    const jsxElementNode = parentElementPath.node;
                    const children = jsxElementNode.children || [];

                    const textParts = Array.isArray(change.textParts)
                      ? change.textParts
                      : null;

                    if (textParts) {
                      const textLikeNodes = children.filter(
                        (child) =>
                          t.isJSXText(child) ||
                          (t.isJSXExpressionContainer(child) &&
                            t.isStringLiteral(child.expression)),
                      );

                      const oldContent = textLikeNodes
                        .map((child) => {
                          if (t.isJSXText(child)) return child.value || "";
                          if (
                            t.isJSXExpressionContainer(child) &&
                            t.isStringLiteral(child.expression)
                          ) {
                            return child.expression.value || "";
                          }
                          return "";
                        })
                        .join("");

                      textLikeNodes.forEach((child, index) => {
                        const nextValue = textParts[index] ?? "";
                        if (t.isJSXText(child)) {
                          child.value = nextValue;
                        } else if (
                          t.isJSXExpressionContainer(child) &&
                          t.isStringLiteral(child.expression)
                        ) {
                          child.expression.value = nextValue;
                        }
                      });

                      if (textParts.length > textLikeNodes.length) {
                        const extraNodes = textParts
                          .slice(textLikeNodes.length)
                          .map((part) => t.jsxText(part ?? ""));
                        jsxElementNode.children = [...children, ...extraNodes];
                      }

                      edits.push({
                        file: getRelativePath(targetFile),
                        lineNumber: lineNumber,
                        element: elementName,
                        type: "textContent",
                        oldData: oldContent,
                        newData: textParts.join(""),
                      });
                    } else {
                      let targetTextNode = null;
                      for (const child of children) {
                        if (t.isJSXText(child) && child.value.trim().length > 0) {
                          targetTextNode = child;
                          break;
                        }
                      }

                      const firstTextNode = targetTextNode;
                      const fallbackWhitespaceNode = children.find(
                        (child) => t.isJSXText(child) && child.value.trim().length === 0,
                      );

                      const newContent = change.textContent;
                      let oldContent = "";

                      const preserveWhitespace = (originalValue, updatedCore) => {
                        const leadingWhitespace =
                          (originalValue.match(/^\s*/) || [""])[0];
                        const trailingWhitespace =
                          (originalValue.match(/\s*$/) || [""])[0];
                        return `${leadingWhitespace}${updatedCore}${trailingWhitespace}`;
                      };

                      if (firstTextNode) {
                        oldContent = firstTextNode.value.trim();
                        firstTextNode.value = preserveWhitespace(
                          firstTextNode.value,
                          newContent,
                        );
                      } else if (fallbackWhitespaceNode) {
                        oldContent = "";
                        fallbackWhitespaceNode.value = preserveWhitespace(
                          fallbackWhitespaceNode.value,
                          newContent,
                        );
                      } else {
                        oldContent = "";
                        const newTextNode = t.jsxText(newContent);
                        jsxElementNode.children = [newTextNode, ...children];
                      }

                      edits.push({
                        file: getRelativePath(targetFile),
                        lineNumber: lineNumber,
                        element: elementName,
                        type: "textContent",
                        oldData: oldContent,
                        newData: newContent,
                      });
                    }
                  }
                } else if (
                  change.type === "content" &&
                  change.content !== undefined
                ) {
                  // CONTENT-ONLY PROCESSING
                  console.log(
                    `[backend] Processing content-only change:`,
                    change.content.slice(0, 100),
                  );

                  const parentElementPath = path.parentPath;
                  if (parentElementPath && parentElementPath.isJSXElement()) {
                    // Capture old content before modifying
                    const oldChildren = parentElementPath.node.children || [];
                    const generate = require("@babel/generator").default;
                    const oldContentAST = {
                      type: "JSXFragment",
                      children: oldChildren,
                    };
                    const oldContent = generate(oldContentAST, {}, "")
                      .code.replace(/^<>/, "")
                      .replace(/<\/>$/, "")
                      .trim();

                    const newChildren = parseJsxChildren(change.content);
                    if (newChildren) {
                      parentElementPath.node.children = newChildren;
                    }

                    // Track this edit
                    edits.push({
                      file: getRelativePath(targetFile),
                      lineNumber: lineNumber,
                      element: elementName,
                      type: "content",
                      oldData: oldContent,
                      newData: change.content,
                    });
                  }
                } else {
                  // Track rejected change
                  const reason = `Change must have valid type ('className', 'textContent', or 'content'). Received type: ${change.type || 'undefined'}`;
                  rejectedChanges.push({
                    change,
                    reason,
                    file: getRelativePath(targetFile),
                    lineNumber: lineNumber,
                    element: elementName,
                  });

                  // Still log for debugging
                  console.error(`[backend] REJECTED: ${reason}`, change);
                  console.error(
                    `[backend] This change will be IGNORED to prevent contamination.`,
                  );
                }
              });

              // Mark all changes at this line as processed
              delete changesByLine[lineNumber];
            },
          });

          // Generate updated code
          const { code } = generate(ast, {
            retainLines: true,
            retainFunctionParens: true,
            comments: true,
          });

          // Optional: Create backup before writing
          const backupFile = targetFile + ".backup";
          if (fs.existsSync(targetFile)) {
            const originalContent = fs.readFileSync(targetFile, "utf8");
            fs.writeFileSync(backupFile, originalContent, "utf8");
          }

          // Write the updated content
          fs.writeFileSync(targetFile, code, "utf8");

          // Commit changes to git with timestamp
          const timestamp = Date.now();
          try {
            // Use -c flag for per-invocation git config to avoid modifying any config
            execSync(`git -c user.name="visual-edit" -c user.email="maria.garcia@eniit.es" add "${targetFile}"`);
            execSync(`git -c user.name="visual-edit" -c user.email="maria.garcia@eniit.es" commit -m "visual_edit_${timestamp}"`);
          } catch (gitError) {
            console.error(`Git commit failed: ${gitError.message}`);
            // Continue even if git fails - file write succeeded
          }

          // Clean up backup file after successful write and commit
          if (fs.existsSync(backupFile)) {
            fs.unlinkSync(backupFile);
          }
        });

        const response = { status: "ok", edits };
        if (rejectedChanges.length > 0) {
          response.rejectedChanges = rejectedChanges;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Add OPTIONS handler for CORS preflight
    devServer.app.options("/edit-file", (req, res) => {
      const origin = req.get("Origin");
      if (origin && isAllowedOrigin(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, x-api-key");
        res.sendStatus(200);
      } else {
        res.sendStatus(403);
      }
    });

    return middlewares;
  };
  return config;
}

module.exports = setupDevServer;