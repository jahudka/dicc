# DICC

> **_Dependency Injection Container Compiler_**

This is a project to _end_ all current TypeScript DI implementations.
I mean it. **All of them**. With extreme prejudice.

Why? Because they are all based on decorators. (Well, there is _one_ exception,
and that project was actually what finally pushed me to do this; more on that
later.) Don't get me wrong - decorators are awesome! I love decorators. I've
built a pretty big library based _entirely_ on decorators.

But - and I _cannot stress this enough_ - decorator-based dependency injection
breaks one of the most sacred dependency injection principles - **your code
should almost NEVER know or care that dependency injection even exists**, and it
most certainly shouldn't know anything about the specifics of the DI
_implementation_ - in other words, your code _should not depend on your
preferred dependency injection solution_. Because if it does, then it's not
portable, you can't just easily extract parts of it into a shared library,
you cannot test it independently of the DI framework, you're simply locked in,
you're alone in the dark, you're locked in and there are drums in the deep and
they are coming and you cannot get out and you don't have Gandalf to save you
and

&lt;/rant&gt;

&lt;zen&gt;

DICC can't do the pointy hat trick, but it does offer an alternative solution
to dependency injection. You write a simple _definition file_ in plain
TypeScript, that is, a standard `.ts` file with some `export const ... = ...`
statements, and then you point DICC to that file and DICC will produce a
_compiled file_, which exports a fully typed and autowired dependency injection
container.

The only place in your code you will ever `import { anything } from 'dicc'`
will be inside the definition file (or files).

### Highlights
 - type-based autowiring, doesn't care about type or parameter names
 - supports multiple services of the same type
 - supports _async_ services (that is, services which need to be created
   asynchronously)
 - supports _scoped_ services private to a given asynchronous execution
   context, as well as fully private services
 - supports _dynamic_ services which are known to the container, but must be
   registered manually in order to be available as dependencies to other
   services
 - on top of injecting simple dependencies, supports a few other injection
   schemes, based on the declared type of the argument being injected:
   - `Promise<T>` - will inject a Promise for an async service without waiting
     to resolve it
   - `T[]` - will inject an array containing all services of type `T`; `T` can
     be `Promise<T[]>` for async services
   - `() => T` - will inject an _accessor_ for service of type `T`; `T` can be
     `T`, `T[]`, `Promise<T>` or `Promise<T[]>`
   - `Iterable<T>` - will inject an _iterable_ which allows lazy iteration over
     all services of type `T`
   - `AsyncIterable<T>` - same thing for async services

### Note on types

TypeScript is a _structurally-typed_ language, meaning a type is considered
assignable to another type if it has a matching structure. Type resolution in
DICC, however, is strictly referential, and therefore DICC can be said to use
_nominal_ typing for dependency resolution. In practice, it shouldn't limit you
much, but it's something to be aware of.


## Installation

DICC is split into two packages, because the compiler depends on TypeScript
and ts-morph, which are probably both something you want to be able to prune
from your production node modules. The runtime package is tiny and doesn't have
any other dependencies.

```shell
# Compile-time dependency:
npm i --save-dev dicc-compiler

# Runtime dependency:
npm i --save dicc
```

## Usage

### Defining services

Service definitions must all be exported from a single module. That module may
re-export definitions from other modules, if it gets too large and you want to
split it up. A simple service definition looks like this:

```typescript
import { createDefinition } from 'dicc';
import { HttpServer } from 'insaner';

export const httpServer = createDefinition(HttpServer);
```

Services can also be given _aliases_ - additional types the compiler should
consider as being provided by the service. Think interfaces which the service
implements. This is done using a `satisfies` expression:

```typescript
export const httpServer = createDefinition(
  HttpServer,
) satisfies ServiceTypes<HttpServer, HttpServerInterface>;
```

Multiple aliases can be specified as a tuple using
`satisfies ServiceTypes<T, [A1, A2, A3]>`. Note that the service must actually
conform to all the alias types.

Public service IDs (meaning IDs you can safely use in your code to get services
from the container) are derived from the path to the service definition in the
exported definition tree. For example:

```typescript
// file: di/definitions/orm.ts
export const userRepository = createDefinition(UserRepository);
export const commentRepository = createDefinition(CommentRepository);

// file: di/definitions/index.ts
// this is the input file for DICC
export * as orm from './orm';

// the generated container will have these services:
container.get('orm.userRepository');
container.get('orm.commentRepository');
```


### Compiling a container

Whenever you change service definitions you must re-run the compiler in order
to get a matching container. This is done using the `dicc` executable shipped
with DICC. The executable takes the following options:

 - `-i` / `--input`: **required**, the path to the module which exports your
   definitions.
 - `-o` / `--output`: **required**, the path to the module which should contain
   the compiled container. This file will be overwritten!
 - `-p` / `--project`: the path to `tsconfig.json`. Defaults to
   `./tsconfig.json`.
 - `-e` / `--export`: the name of the variable holding the compiled container
   instance exported from the compiled module. Defaults to `container`.

Example:

```shell
node_modules/.bin/dicc -i src/di/definitions/index.ts -o src/di/index.ts
```
