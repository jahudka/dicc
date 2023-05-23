import { Container, ServiceType } from 'dicc';
import * as defs from './definitions';

export interface Services {
  'autowiring': ServiceType<typeof defs.autowiring>;
  'compiler': ServiceType<typeof defs.compiler>;
  'definitionScanner': ServiceType<typeof defs.definitionScanner>;
  'dicc': ServiceType<typeof defs.dicc>;
  'options': ServiceType<typeof defs.options>;
  'project': ServiceType<typeof defs.project>;
  'serviceRegistry': ServiceType<typeof defs.serviceRegistry>;
  'sourceFiles': ServiceType<typeof defs.sourceFiles>;
  'typeHelper': ServiceType<typeof defs.typeHelper>;
}

export const container = new Container<Services>({
  'autowiring': {
    aliases: ['Autowiring.0'],
    factory: (di) => new defs.autowiring(
      di.get('ServiceRegistry.0'),
    ),
  },
  'compiler': {
    aliases: ['Compiler.0'],
    factory: (di) => new defs.compiler(
      di.get('ServiceRegistry.0'),
      di.get('Autowiring.0'),
      di.get('SourceFiles.0'),
      di.get('DiccOptions.0'),
    ),
  },
  'definitionScanner': {
    aliases: ['DefinitionScanner.0'],
    factory: (di) => new defs.definitionScanner(
      di.get('ServiceRegistry.0'),
      di.get('TypeHelper.0'),
    ),
  },
  'dicc': {
    aliases: ['Dicc.0'],
    factory: (di) => new defs.dicc(
      di.get('SourceFiles.0'),
      di.get('TypeHelper.0'),
      di.get('DefinitionScanner.0'),
      di.get('Autowiring.0'),
      di.get('Compiler.0'),
    ),
  },
  'options': {
    aliases: ['DiccOptions.0'],
    factory: null,
  },
  'project': {
    aliases: ['Project.0'],
    factory: (di) => defs.project(
      di.get('DiccOptions.0'),
    ),
  },
  'serviceRegistry': {
    aliases: ['ServiceRegistry.0'],
    factory: () => new defs.serviceRegistry(),
  },
  'sourceFiles': {
    aliases: ['SourceFiles.0'],
    factory: (di) => new defs.sourceFiles(
      di.get('Project.0'),
      di.get('DiccOptions.0'),
    ),
  },
  'typeHelper': {
    aliases: ['TypeHelper.0'],
    factory: (di) => new defs.typeHelper(
      di.get('SourceFiles.0'),
    ),
  },
});



