import * as path from "path";
import * as fs from "fs";
import { createMacro, MacroParams } from "babel-plugin-macros";
import { File } from "@babel/types";
import { NodePath } from "@babel/traverse";

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

function processRules(parameters: MacroParams) {
  const { state, babel } = parameters;

  const rules: Array<string> = [];

  const indexRef = { current: 0 };

  babel.traverse(state.file.ast, {
    StringLiteral(path) {
      processSingleRule(parameters, { path, rules }, path.node.value, indexRef);
    },

    TemplateElement(path) {
      processSingleRule(
        parameters,
        { path, rules },
        path.node.value.raw,
        indexRef
      );
    },
  });

  return rules.join("");
}

const IMPORT_NAME = "__twa__";

function processSingleRule(
  { babel }: MacroParams,
  { path, rules }: { path: NodePath; rules: Array<string> },
  value: string,
  indexRef: { current: number }
) {
  if (value.startsWith("@apply ")) {
    const selector = `twa${indexRef.current}`;

    path.replaceWith(
      (babel.parse(`${IMPORT_NAME}.${selector}`) as File).program.body[0]
    );

    rules.push(`.${selector}{${value};}`);

    indexRef.current++;
  }
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
