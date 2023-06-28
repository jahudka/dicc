import { ServiceDefinition } from 'dicc';
import { IndentationText, NewLineKind, Project, QuoteKind } from 'ts-morph';
import { ConfigLoader } from './configLoader';
import { Dicc } from './dicc';
import { DiccConfig } from './types';

export { Argv } from './argv';
export { Autowiring } from './autowiring';
export { Checker } from './checker';
export { Compiler } from './compiler';
export { ConfigLoader } from './configLoader';
export { DefinitionScanner } from './definitionScanner';
export { ServiceRegistry } from './serviceRegistry';
export { SourceFiles } from './sourceFiles';
export { TypeHelper } from './typeHelper';

export const config = (
  async (loader: ConfigLoader) => loader.load()
) satisfies ServiceDefinition<DiccConfig>;

export const project = ((config: DiccConfig) => new Project({
  tsConfigFilePath: config.project,
  manipulationSettings: {
    indentationText: IndentationText.TwoSpaces,
    newLineKind: NewLineKind.LineFeed,
    quoteKind: QuoteKind.Single,
    useTrailingCommas: true,
  },
})) satisfies ServiceDefinition<Project>;

export const dicc = Dicc satisfies ServiceDefinition<Dicc>;
