# Services and dependencies

There are two distinct tasks you'll need to tackle in order to use DICC in your
project: you'll need to code your services (duh) and you'll need to provide
definitions to the DICC compiler. We'll look at service definitions first.


## Defining services

As briefly mentioned before, a _service definition_ is a special `satisfies`
expression exported from a definition file. This is what it looks like:

```typescript
import { ServiceDefinition } from 'dicc';

// the simplest kind of definition - an instantiable class service:
export const one = ServiceOne satisfies ServiceDefinition<ServiceOne>;

// a definition with aliases:
export const twoWithOneAlias = ServiceTwo satisfies ServiceDefinition<ServiceTwo, AliasOne>;
export const twoWithMultipleAliases = ServiceTwo satisfies ServiceDefinition<ServiceTwo, [AliasOne, AliasTwo]>;

// a definition using a factory function:
export const three = (() => new ServiceThree()) satisfies ServiceDefinition<ServiceThree>;
export const alsoThree = ServiceThree.create satisfies ServiceDefinition<ServiceThree>;

// a definition using an object literal, allowing us to specify other options:
export const four = {
  factory: ServiceFour,
  onCreate() { console.log('Four created!') },
} satisfies ServiceDefinition<ServiceFour>;

// a factory function can be async:
export const five = (async () => new ServiceFive()) satisfies ServiceDefinition<ServiceFive>;
export const alsoFive = {
  async factory() { return new ServiceFive() },
  onCreate() { console.log('Five created!') }
} satisfies ServiceDefinition<ServiceFive>;

// factories may return undefined if a service cannot be created:
export const maybeSix = (
  () => process.env.WITH_SIX ? new ServiceSix() : undefined
) satisfies ServiceDefinition<ServiceSix>;

// factories themselves can be undefined - this makes the service dynamic,
// that is, the compiler can include code to inject it as a dependency to other
// services, but the runtime container can't create it and instead you need to
// register it manually:
export const seven = undefined satisfies ServiceDefinition<ServiceSeven>;
export const alsoSeven = {
  factory: undefined,
  onCreate() { console.log('Seven registered in the container!') },
} satisfies ServiceDefinition<ServiceSeven>;
```

A definition file can re-export definitions from other files:

```typescript
// logger.ts
export const logger = <definition>;

// orm.ts
export const repository = {
  author: <definition>,
  book: <definition>,
};

// controllers/admin.ts
export namespace controllers {
  export const createBook = <defintion>;
  export const deleteBook = <definition>;
}

// controllers/public.ts
export namespace controllers {
  export const listBooks = <definition>;
}

// controllers/index.ts
export * from './admin';
export * from './public';

// definitions.ts
export * from './logger';
export * as orm from './orm';
export * from './controllers';

// exported service definition tree would look like this:
const defs = {
  logger: <definition>,
  orm: {
    repository: {
      author: <definition>,
      book: <definition>,
    },
  },
  controllers: {
    createBook: <definition>,
    deleteBook: <definition>,
    listBooks: <definition>,
  },
};

// this, in turn, would result in the following flattened service IDs:
container.get('logger');
container.get('orm.repository.author');
container.get('controllers.listBooks');
// etc
```

Now that we know how to tell DICC about services, let's see how we can tell it
what those services depend on.


## Injecting dependencies

As explained in the previous sections, DICC will analyse the constructor or
factory of each defined service and attempt to inject the correct values into
its arguments when the service is being created. There are several ways services
can depend on other services. We'll explore all the options using some examples.
The first thing we'll look at is simply injecting a single instance of a
dependency directly. We can assume that the appropriate service definitions for
all the service classes in the following snippet exist, they're not important
here:

```typescript
// no constructor, or a constructor with no arguments, means no dependencies
export class ServiceOne {}

// a similar example, but with an async factory, making ServiceTwo async:
export class ServiceTwo {
  static async create(): Promise<ServiceTwo> {
    return new ServiceTwo();
  }
}

// ServiceThree depends on both services directly - it doesn't care if either
// service it depends on is async, it just wants the resolved instances; the
// compiled factory for ServiceThree would therefore be async in order to be
// able to resolve the promise for ServiceTwo, but ServiceThree itself doesn't
// need to know or care:
export class ServiceThree {
  constructor(
    readonly one: ServiceOne,
    readonly two: ServiceTwo,
  ) {}
}

// ServiceFour is an example where a promise for ServiceTwo needs to be injected
// and it's then ServiceFour's job to await it when it needs access to the
// ServiceTwo instance; it adds some complexity to ServiceFour, but it means
// that it can be created synchronously, even though it depends on an async
// service:
export class ServiceFour {
  constructor(readonly two: Promise<ServiceTwo>) {}
}

// ServiceFive shows an example of depending on optional services.
// Let's first imagine an optional service:
export class ServiceBar {
  create(): ServiceBar | undefined {
    return process.env.WITH_BAR ? new ServiceBar() : undefined;
  }
}

export class ServiceFive {
  constructor(
    readonly one?: ServiceOne, // would inject ServiceOne
    readonly foo?: ServiceFoo, // would inject undefined - no such service exists
    readonly bar?: ServiceBar, // would inject ServiceBar | undefined
                               // based on what ServiceBar.create() returns
  ) {}
}
```

This covers the most common and most simple injection modes, but DICC can do
a lot more than that. For example, you can depend on an _accessor_ for a
service - a callback with no arguments which will return the requested service.
This can be useful to break cyclic dependencies (an accessor is not a direct
dependency), or to let a potentially heavy service be initialised lazily only
when it's needed:

```typescript
export class ServiceFive {
  constructor(
    readonly getOne: () => ServiceOne,
    readonly getTwo: () => Promise<ServiceTwo>, // accessor for an async service
  ) {}
}
```

Another thing DICC allows you to do is define (directly or via aliases)
multiple services of the same type and then to inject all services of a given
type as an array:

```typescript
export interface Logger {
  log(message: string): void;
}

// in definitions.ts you would add the Logger interface as an alias
// to both of the following services:
export class ConsoleLogger {
  log(message: string): void {
    console.log(message);
  }
}

export class FileLogger {
  private readonly file: WritableStream;

  log(message: string): void {
    this.file.getWriter().write(message);
  }
}

// AggregatedLogger will get all the services with the Logger alias;
// note that it mustn't be given the Logger alias itself, as that would
// make the container attempt to inject it into itself, which would fail:
export class AggregatedLogger {
  constructor(private readonly loggers: Logger[]) {}

  log(message: string): void {
    for (const logger of this.loggers) {
      logger.log(message);
    }
  }
}
```

If one or more of the services of the type you wish to inject is async, you
can ask DICC to inject a Promise for the array, e.g.:

```typescript
export class AggregatedLogger {
  constructor(private readonly loggers: Promise<Logger[]>) {}
}
```

You can combine accessor and array injection:

```typescript
export class AggregatedLogger {
  constructor(
    // for sync services:
    private readonly getLoggers: () => Logger[],
    // if one or more of the services is async:
    private readonly getLoggersAsync: () => Promise<Logger[]>,
  ) {}
}
```

Last, but not least, you can inject _iterables_ - this also allows you to inject
a bunch of services of the same type, but unlike injecting an array (or an
accessor for an array), each service in the iterable will be lazily resolved
when the iterable reaches it. Works for sync and async services:

```typescript
export class AggregatedLogger {
  constructor(
    // for sync services:
    private readonly loggers: Iterable<Logger>,
    // if one or more of the services is async:
    private readonly asyncLoggers: AsyncIterable<Logger>,
  ) {}
}
```

Note that accessors and iterables in combination with async services can break
one of the core DI concepts - that services shouldn't care how their
dependencies are created. If you need to inject an accessor or an iterable, you
need to know whether (one or more of) the injected service(s) is async - e.g.
service X, which needs to have an accessor for service Y, needs to type the
accessor according to the definition (and dependencies) of service Y - the
accessor must either return `Y`, or `Promise<Y>`, but X shouldn't have to deal
with that. But I don't know of any mechanism which could circumvent this. At
least it isn't a dependency on the DI framework itself - the requirement to
appropriately pick whether X should depend on `() => Y` or `() => Promise<Y>`
arises from application code, and as far as I can tell, there is no way this
could be resolved in _any_ framework which allows async services (well, not
unless other contracts are broken - such as accessors and iterables being lazy,
which seems like a more important feature). In any case, you don't have to
_think_ about it too much, because DICC will throw an error during compilation
if you try to inject a non-async accessor or iterable for something which _is_
async.

**Next**: [Going live][1]

[1]: ./04-going-live.md
