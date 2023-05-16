import { Autowiring } from './autowiring';
import { Compiler } from './compiler';
import { DefinitionScanner } from './definitionScanner';
import { ServiceRegistry } from './serviceRegistry';
import { SourceFiles } from './sourceFiles';
import { TypeHelper } from './typeHelper';
import { DiccOptions } from './types';

export class Dicc {
  private readonly sourceFiles: SourceFiles;
  private readonly helper: TypeHelper;
  private readonly registry: ServiceRegistry;
  private readonly scanner: DefinitionScanner;
  private readonly autowiring: Autowiring;
  private readonly compiler: Compiler;
  private readonly options: DiccOptions;

  constructor(
    sourceFiles: SourceFiles,
    helper: TypeHelper,
    registry: ServiceRegistry,
    scanner: DefinitionScanner,
    autowiring: Autowiring,
    compiler: Compiler,
    options: DiccOptions,
  ) {
    this.sourceFiles = sourceFiles;
    this.helper = helper;
    this.registry = registry;
    this.scanner = scanner;
    this.autowiring = autowiring;
    this.compiler = compiler;
    this.options = options;
  }

  async compile(): Promise<void> {
    const input = this.sourceFiles.getInput();
    const output = this.sourceFiles.getOutput();

    this.scanner.scanDefinitions(input);
    this.autowiring.checkDependencies();
    this.scanner.scanUsages();

    this.compiler.compile(
      this.registry.getDefinitions(),
      input,
      output,
      this.options.export ?? 'container',
    );

    this.helper.destroy();
    await output.save();
  }
}
