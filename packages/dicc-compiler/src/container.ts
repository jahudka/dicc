import { Container } from 'dicc';
import * as defs from './definitions';

export const container = new Container({
  'autowiring': {
    aliases: ['Autowiring.0'],
    factory: (di: Container) => new defs.autowiring(
      di.get('ServiceRegistry.0'),
    ),
  },
  'compiler': {
    aliases: ['Compiler.0'],
    factory: (di: Container) => new defs.compiler(
      di.get('Autowiring.0'),
    ),
  },
  'definitionScanner': {
    aliases: ['DefinitionScanner.0'],
    factory: (di: Container) => new defs.definitionScanner(
      di.get('ServiceRegistry.0'),
      di.get('TypeHelper.0'),
    ),
  },
  'dicc': {
    aliases: ['Dicc.0'],
    factory: (di: Container) => new defs.dicc(
      di.get('SourceFiles.0'),
      di.get('TypeHelper.0'),
      di.get('ServiceRegistry.0'),
      di.get('DefinitionScanner.0'),
      di.get('Autowiring.0'),
      di.get('Compiler.0'),
      di.get('DiccOptions.0'),
    ),
  },
  'options': {
    aliases: ['DiccOptions.0'],
    factory: null,
  },
  'project': {
    aliases: ['Project.0'],
    factory: (di: Container) => defs.project(
      di.get('DiccOptions.0'),
    ),
  },
  'serviceRegistry': {
    aliases: ['ServiceRegistry.0'],
    factory: () => new defs.serviceRegistry(),
  },
  'sourceFiles': {
    aliases: ['SourceFiles.0'],
    factory: (di: Container) => new defs.sourceFiles(
      di.get('Project.0'),
      di.get('DiccOptions.0'),
    ),
  },
  'typeHelper': {
    aliases: ['TypeHelper.0'],
    factory: (di: Container) => new defs.typeHelper(
      di.get('SourceFiles.0'),
    ),
  },
});


