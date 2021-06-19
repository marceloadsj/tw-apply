import * as path from "path";
import * as fs from "fs";
import { createMacro, MacroParams } from "babel-plugin-macros";
import {
  File,
  TemplateElement,
  Expression,
  TSType,
  MemberExpression,
} from "@babel/types";

interface Config {
  fileSuffix?: string;
}

export default createMacro(
  (parameters) => {
    const { fileSuffix, filename } = validateParameters(parameters);

    const cssFilename = getCssFilename(filename, fileSuffix);
    const rules = processRules(parameters);

    createCssFile(filename, cssFilename, rules);
    injectCssImport(parameters, cssFilename);
  },
  { configName: "twApply" }
);

function validateParameters({ state, config }: MacroParams) {
  const parsedConfig = validateConfig(config as Config);

  const { filename } = state.file.opts;

  if (!filename) {
    throw Error(`The "filename" property was not found.`);
  }

  return { ...parsedConfig, filename };
}

function validateConfig(config: Config) {
  if (config.fileSuffix && typeof config.fileSuffix !== "string") {
    throw Error(`Config fileSuffix "${config.fileSuffix}" is not supported.`);
  }

  return {
    fileSuffix: config.fileSuffix || "",
  };
}

const IMPORT_NAME = "__twa__";

function processRules(parameters: MacroParams) {
  const { state, babel } = parameters;

  const rules: Array<string> = [];

  const indexRef = { current: 0 };

  babel.traverse(state.file.ast, {
    StringLiteral(path) {
      const selector = createSelector(rules, path.node.value, indexRef);

      if (selector) {
        path.replaceWith(
          babel.types.stringLiteral(`${IMPORT_NAME}.${selector}`)
        );
      }
    },

    TemplateLiteral(path) {
      const quasis: Array<TemplateElement> = [];
      const expressions: Array<Expression | TSType | MemberExpression> = [];

      path.node.quasis.forEach((templateNode, index) => {
        const selector = createSelector(
          rules,
          templateNode.value.raw,
          indexRef
        );

        if (selector) {
          injectTemplateElements(
            parameters,
            templateNode,
            selector,
            quasis,
            expressions
          );
        } else {
          quasis.push(templateNode);
        }

        if (path.node.expressions[index]) {
          expressions.push(path.node.expressions[index]);
        }
      });

      path.node.quasis = quasis;
      path.node.expressions = expressions;
    },
  });

  return rules.join("");
}

function createSelector(
  rules: Array<string>,
  value: string,
  indexRef: { current: number }
) {
  let selector: string | undefined;

  if (value.trim().startsWith("@apply ")) {
    selector = `twa${indexRef.current}`;

    rules.push(`.${selector}{${value};}`);

    indexRef.current++;
  }

  return selector;
}

function injectTemplateElements(
  { babel }: MacroParams,
  templateNode: TemplateElement,
  selector: string,
  quasis: Array<TemplateElement>,
  expressions: Array<Expression | TSType | MemberExpression>
) {
  // Inject left and right empty spaces correctly
  const leftTemplate = templateNode.value.raw.startsWith(" ") ? " " : "";

  quasis.push(
    babel.types.templateElement({
      raw: leftTemplate,
      cooked: leftTemplate,
    })
  );

  expressions.push(
    babel.types.memberExpression(
      babel.types.identifier(IMPORT_NAME),
      babel.types.identifier(selector)
    )
  );

  const rightTemplate = templateNode.value.raw.endsWith(" ") ? " " : "";

  quasis.push(
    babel.types.templateElement({
      raw: rightTemplate,
      cooked: rightTemplate,
    })
  );
}

function getCssFilename(filename: string, fileSuffix: string) {
  // Css filename will follow `${basename}${fileSuffix}.module.css``
  return `${path.basename(
    filename,
    path.extname(filename)
  )}${fileSuffix}.module.css`;
}

function injectCssImport({ state, babel }: MacroParams, filename: string) {
  state.file.ast.program.body.unshift(
    (babel.parse(`import ${IMPORT_NAME} from "./${filename}";`) as File).program
      .body[0]
  );
}

function createCssFile(filename: string, cssFilename: string, rules: string) {
  fs.writeFileSync(
    filename.replace(path.basename(filename), cssFilename),
    rules
  );
}
