import { IndentationText, NewLineKind, Project, QuoteKind } from 'ts-morph';
import { createDefinition } from '../lib';
import { Autowiring } from './autowiring';
import { Compiler } from './compiler';
import { DefinitionScanner } from './definitionScanner';
import { Dicc } from './dicc';
import { ServiceRegistry } from './serviceRegistry';
import { TypeHelper } from './typeHelper';
import { DiccOptions } from './types';

export const project = createDefinition((options: DiccOptions) => new Project({
  tsConfigFilePath: options.project,
  manipulationSettings: {
    indentationText: IndentationText.TwoSpaces,
    newLineKind: NewLineKind.LineFeed,
    quoteKind: QuoteKind.Single,
    useTrailingCommas: true,
  },
}));

export const typeHelper = createDefinition(TypeHelper);
export const serviceRegistry = createDefinition(ServiceRegistry);
export const definitionScanner = createDefinition(DefinitionScanner);
export const autowiring = createDefinition(Autowiring);
export const compiler = createDefinition(Compiler);
export const options = createDefinition<DiccOptions>(null);
export const dicc = createDefinition(Dicc);
