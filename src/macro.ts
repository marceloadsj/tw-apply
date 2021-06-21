import * as path from "path";
import * as fs from "fs";
import { createMacro, MacroParams } from "babel-plugin-macros";
import {
  File,
  Expression,
  TSType,
  TemplateLiteral,
  TemplateElement,
  MemberExpression,
} from "@babel/types";
import { NodePath } from "@babel/core";

export default createMacro(
  (parameters) => {
    validateParameters(parameters);

    const { cssFilename, cssBasename } = getConfigs(parameters);
    const rules = processRules(parameters);

    fs.writeFileSync(cssFilename, rules);
    injectCssImport(parameters, cssBasename);
  },
  { configName: "twApply" }
);

function validateParameters({ state, config = {} }: MacroParams) {
  const fileSuffix = config.fileSuffix;

  if (fileSuffix && typeof fileSuffix !== "string") {
    throw Error(`Config fileSuffix "${config.fileSuffix}" is not supported.`);
  }

  const { filename } = state.file.opts;

  if (!filename) {
    throw Error(`The "filename" property was not found.`);
  }
}

function getConfigs({ state, config }: MacroParams) {
  const fileSuffix = config!.fileSuffix || "";
  const filename = state.file.opts.filename!;

  // Css basename will follow `${basename}${fileSuffix}.module.css``
  const cssBasename = `${path.basename(
    filename,
    path.extname(filename)
  )}${fileSuffix}.module.css`;

  const cssFilename = filename.replace(path.basename(filename), cssBasename);

  return { cssBasename, cssFilename };
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
          babel.types.memberExpression(
            babel.types.identifier(IMPORT_NAME),
            babel.types.identifier(selector)
          )
        );
      }
    },

    TemplateLiteral(path) {
      const quasis: Array<TemplateElement> = [];
      const expressions: Array<Expression | TSType | MemberExpression> = [];

      path.node.quasis.forEach((templateNode, index) =>
        processQuasis(
          parameters,
          rules,
          indexRef,
          quasis,
          expressions,
          path,
          templateNode,
          index
        )
      );

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

  const parsedValue = value.trim();

  if (parsedValue.startsWith("@apply ")) {
    selector = `twa${indexRef.current}`;

    rules.push(`.${selector}{${parsedValue};}`);

    indexRef.current++;
  }

  return selector;
}

function processQuasis(
  parameters: MacroParams,
  rules: Array<string>,
  indexRef: { current: number },
  quasis: Array<TemplateElement>,
  expressions: Array<Expression | TSType | MemberExpression>,
  path: NodePath<TemplateLiteral>,
  templateNode: TemplateElement,
  index: number
) {
  const selector = createSelector(rules, templateNode.value.raw, indexRef);

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

function injectCssImport({ state, babel }: MacroParams, filename: string) {
  state.file.ast.program.body.unshift(
    babel.types.importDeclaration(
      [babel.types.importDefaultSpecifier(babel.types.identifier(IMPORT_NAME))],
      babel.types.stringLiteral(`./${filename}`)
    )
  );
}
