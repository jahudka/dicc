import { ServiceDefinition } from 'dicc';
import { IndentationText, NewLineKind, Project, QuoteKind } from 'ts-morph';
import { Autowiring } from './autowiring';
import { Compiler } from './compiler';
import { DefinitionScanner } from './definitionScanner';
import { Dicc } from './dicc';
import { ServiceRegistry } from './serviceRegistry';
import { SourceFiles } from './sourceFiles';
import { TypeHelper } from './typeHelper';
import { DiccOptions } from './types';

export const project = ((options: DiccOptions) => new Project({
  tsConfigFilePath: options.project ?? './tsconfig.json',
  manipulationSettings: {
    indentationText: IndentationText.TwoSpaces,
    newLineKind: NewLineKind.LineFeed,
    quoteKind: QuoteKind.Single,
    useTrailingCommas: true,
  },
})) satisfies ServiceDefinition<Project>;

export const sourceFiles = SourceFiles satisfies ServiceDefinition<SourceFiles>;
export const typeHelper = TypeHelper satisfies ServiceDefinition<TypeHelper>;
export const serviceRegistry = ServiceRegistry satisfies ServiceDefinition<ServiceRegistry>;
export const definitionScanner = DefinitionScanner satisfies ServiceDefinition<DefinitionScanner>;
export const autowiring = Autowiring satisfies ServiceDefinition<Autowiring>;
export const compiler = Compiler satisfies ServiceDefinition<Compiler>;
export const options = null satisfies ServiceDefinition<DiccOptions>;
export const dicc = Dicc satisfies ServiceDefinition<Dicc>;
