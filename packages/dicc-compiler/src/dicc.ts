import { Autowiring } from './autowiring';
import { Compiler } from './compiler';
import { DefinitionScanner } from './definitionScanner';
import { SourceFiles } from './sourceFiles';
import { TypeHelper } from './typeHelper';

export class Dicc {
  private readonly sourceFiles: SourceFiles;
  private readonly helper: TypeHelper;
  private readonly scanner: DefinitionScanner;
  private readonly autowiring: Autowiring;
  private readonly compiler: Compiler;

  constructor(
    sourceFiles: SourceFiles,
    helper: TypeHelper,
    scanner: DefinitionScanner,
    autowiring: Autowiring,
    compiler: Compiler,
  ) {
    this.sourceFiles = sourceFiles;
    this.helper = helper;
    this.scanner = scanner;
    this.autowiring = autowiring;
    this.compiler = compiler;
  }

  async compile(): Promise<void> {
    const input = this.sourceFiles.getInput();
    const output = this.sourceFiles.getOutput();

    this.scanner.scanDefinitions(input);
    this.autowiring.checkDependencies();
    this.scanner.scanUsages();
    this.compiler.compile();

    this.helper.destroy();
    await output.save();
  }
}
