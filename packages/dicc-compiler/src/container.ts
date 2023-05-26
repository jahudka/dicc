import { Container, ServiceType } from 'dicc';
import * as defs0 from './definitions';

export interface Services {
  'autowiring': ServiceType<typeof defs0.autowiring>;
  'compiler': ServiceType<typeof defs0.compiler>;
  'definitionScanner': ServiceType<typeof defs0.definitionScanner>;
  'dicc': ServiceType<typeof defs0.dicc>;
  'options': ServiceType<typeof defs0.options>;
  'project': ServiceType<typeof defs0.project>;
  'serviceRegistry': ServiceType<typeof defs0.serviceRegistry>;
  'sourceFiles': ServiceType<typeof defs0.sourceFiles>;
  'typeHelper': ServiceType<typeof defs0.typeHelper>;
  'Autowiring.0': ServiceType<typeof defs0.autowiring>
  'Compiler.0': ServiceType<typeof defs0.compiler>
  'DefinitionScanner.0': ServiceType<typeof defs0.definitionScanner>
  'Dicc.0': ServiceType<typeof defs0.dicc>
  'DiccOptions.0': ServiceType<typeof defs0.options>
  'Project.0': ServiceType<typeof defs0.project>
  'ServiceRegistry.0': ServiceType<typeof defs0.serviceRegistry>
  'SourceFiles.0': ServiceType<typeof defs0.sourceFiles>
  'TypeHelper.0': ServiceType<typeof defs0.typeHelper>
}

export const container = new Container<Services>({
  'autowiring': {
    aliases: ['Autowiring.0'],
    factory: (di) => new defs0.autowiring(
      di.get('ServiceRegistry.0'),
    ),
  },
  'compiler': {
    aliases: ['Compiler.0'],
    factory: (di) => new defs0.compiler(
      di.get('ServiceRegistry.0'),
      di.get('Autowiring.0'),
      di.get('SourceFiles.0'),
      di.get('DiccOptions.0'),
    ),
  },
  'definitionScanner': {
    aliases: ['DefinitionScanner.0'],
    factory: (di) => new defs0.definitionScanner(
      di.get('ServiceRegistry.0'),
      di.get('TypeHelper.0'),
    ),
  },
  'dicc': {
    aliases: ['Dicc.0'],
    factory: (di) => new defs0.dicc(
      di.get('SourceFiles.0'),
      di.get('TypeHelper.0'),
      di.get('DefinitionScanner.0'),
      di.get('Autowiring.0'),
      di.get('Compiler.0'),
    ),
  },
  'options': {
    aliases: ['DiccOptions.0'],
    factory: undefined,
  },
  'project': {
    aliases: ['Project.0'],
    factory: (di) => defs0.project(
      di.get('DiccOptions.0'),
    ),
  },
  'serviceRegistry': {
    aliases: ['ServiceRegistry.0'],
    factory: () => new defs0.serviceRegistry(),
  },
  'sourceFiles': {
    aliases: ['SourceFiles.0'],
    factory: (di) => new defs0.sourceFiles(
      di.get('Project.0'),
      di.get('DiccOptions.0'),
    ),
  },
  'typeHelper': {
    aliases: ['TypeHelper.0'],
    factory: (di) => new defs0.typeHelper(
      di.get('SourceFiles.0'),
    ),
  },
});



