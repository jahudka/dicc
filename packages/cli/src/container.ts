import { Container, ServiceType } from 'dicc';
import * as defs0 from './definitions';

export interface Services {
  'config': Promise<ServiceType<typeof defs0.config>>;
  'dicc': Promise<ServiceType<typeof defs0.dicc>>;
  'project': Promise<ServiceType<typeof defs0.project>>;
  '#Argv.0': defs0.Argv;
  '#Autowiring.0': defs0.Autowiring;
  '#Checker.0': Promise<defs0.Checker>;
  '#Compiler.0': Promise<defs0.Compiler>;
  '#ConfigLoader.0': defs0.ConfigLoader;
  '#DefinitionScanner.0': Promise<defs0.DefinitionScanner>;
  '#Dicc.0': Promise<ServiceType<typeof defs0.dicc>>;
  '#DiccConfig.0': Promise<ServiceType<typeof defs0.config>>;
  '#Project.0': Promise<ServiceType<typeof defs0.project>>;
  '#ServiceRegistry.0': defs0.ServiceRegistry;
  '#SourceFiles.0': Promise<defs0.SourceFiles>;
  '#TypeHelper.0': Promise<defs0.TypeHelper>;
}

export const container = new Container<Services>({
  'config': {
    aliases: ['#DiccConfig.0'],
    async: true,
    factory: async (di) => defs0.config(di.get('#ConfigLoader.0')),
  },
  'dicc': {
    aliases: ['#Dicc.0'],
    async: true,
    factory: async (di) => new defs0.dicc(
      await di.get('#SourceFiles.0'),
      await di.get('#TypeHelper.0'),
      await di.get('#DefinitionScanner.0'),
      di.get('#Autowiring.0'),
      await di.get('#Compiler.0'),
      await di.get('#Checker.0'),
      await di.get('#DiccConfig.0'),
    ),
  },
  'project': {
    aliases: ['#Project.0'],
    async: true,
    factory: async (di) => defs0.project(await di.get('#DiccConfig.0')),
  },
  '#Argv.0': {
    factory: () => new defs0.Argv(),
  },
  '#Autowiring.0': {
    factory: (di) => new defs0.Autowiring(di.get('#ServiceRegistry.0')),
  },
  '#Checker.0': {
    async: true,
    factory: async (di) => new defs0.Checker(
      await di.get('#TypeHelper.0'),
      di.get('#ServiceRegistry.0'),
    ),
  },
  '#Compiler.0': {
    async: true,
    factory: async (di) => new defs0.Compiler(
      di.get('#ServiceRegistry.0'),
      di.get('#Autowiring.0'),
      await di.get('#SourceFiles.0'),
      await di.get('#DiccConfig.0'),
    ),
  },
  '#ConfigLoader.0': {
    factory: (di) => new defs0.ConfigLoader(di.get('#Argv.0')),
  },
  '#DefinitionScanner.0': {
    async: true,
    factory: async (di) => new defs0.DefinitionScanner(
      di.get('#ServiceRegistry.0'),
      await di.get('#TypeHelper.0'),
    ),
  },
  '#ServiceRegistry.0': {
    factory: () => new defs0.ServiceRegistry(),
  },
  '#SourceFiles.0': {
    async: true,
    factory: async (di) => new defs0.SourceFiles(
      await di.get('#Project.0'),
      await di.get('#DiccConfig.0'),
    ),
  },
  '#TypeHelper.0': {
    async: true,
    factory: async (di) => new defs0.TypeHelper(await di.get('#SourceFiles.0')),
  },
});



