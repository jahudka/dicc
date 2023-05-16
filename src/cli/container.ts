import { Container } from '../lib';
import * as defs from './definitions';
export const container = new Container({
  'autowiring': {
    ...defs.autowiring,
    aliases: ['Autowiring.0'],
    factory: (di: Container) => new defs.autowiring.factory(
      di.get('ServiceRegistry.0'),
    ),
  },
  'compiler': {
    ...defs.compiler,
    aliases: ['Compiler.0'],
    factory: (di: Container) => new defs.compiler.factory(
      di.get('Autowiring.0'),
      di.get('TypeHelper.0'),
    ),
  },
  'definitionScanner': {
    ...defs.definitionScanner,
    aliases: ['DefinitionScanner.0'],
    factory: (di: Container) => new defs.definitionScanner.factory(
      di.get('ServiceRegistry.0'),
      di.get('TypeHelper.0'),
    ),
  },
  'dicc': {
    ...defs.dicc,
    aliases: ['Dicc.0'],
    factory: (di: Container) => new defs.dicc.factory(
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
    ...defs.options,
    aliases: ['DiccOptions.0'],
  },
  'project': {
    ...defs.project,
    aliases: ['Project.0'],
    factory: (di: Container) => defs.project.factory(
      di.get('DiccOptions.0'),
    ),
  },
  'serviceRegistry': {
    ...defs.serviceRegistry,
    aliases: ['ServiceRegistry.0'],
    factory: () => new defs.serviceRegistry.factory(),
  },
  'sourceFiles': {
    ...defs.sourceFiles,
    aliases: ['SourceFiles.0'],
    factory: (di: Container) => new defs.sourceFiles.factory(
      di.get('Project.0'),
      di.get('DiccOptions.0'),
    ),
  },
  'typeHelper': {
    ...defs.typeHelper,
    aliases: ['TypeHelper.0'],
    factory: (di: Container) => new defs.typeHelper.factory(
      di.get('SourceFiles.0'),
    ),
  },
});


