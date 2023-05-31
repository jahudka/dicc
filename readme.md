# DICC

> **_Dependency Injection Container Compiler_**

This is a project to _end_ all current TypeScript DI implementations.
I mean it. **All of them**. With extreme prejudice.

Why? Because they are all based on decorators. (Well, there is _one_ exception,
but that one doesn't - and cannot, properly - support async services, hence
this project.) Don't get me wrong - decorators are awesome! I love decorators.
I've built a pretty big library based _entirely_ on decorators.

But - and I _cannot stress this enough_ - decorator-based dependency injection
breaks one of the most sacred dependency injection principles: **your code
should almost NEVER know or care that dependency injection even exists**, and it
most certainly shouldn't know anything about the specifics of the DI
_implementation_ - in other words, your code _should not depend on your
preferred dependency injection solution_. Because if it does, then it's not
portable, you can't just easily extract parts of it into a shared library,
you cannot test it independently of the DI framework, you're simply locked in,
you're alone in the dark, you're locked in and there are drums in the deep and
they are coming and you cannot get out and you don't have Gandalf and

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

## Highlights
 - type-based autowiring, doesn't care about type or parameter names
 - supports multiple services of the same type
 - supports _async_ services (that is, services which need to be created
   asynchronously)
 - supports _scoped_ services private to a given asynchronous execution
   context, as well as fully private services
 - supports _dynamic_ services which are known to the container, but must be
   registered manually in order to be available as dependencies to other
   services
 - compiles to regular TypeScript which you can easily examine to see what's
   going on under the hood
 - no special compiler flags, no `reflect-metadata`, minimal runtime footprint


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


## Documentation

 - [Intro to Dependency Injection][1] - a general overview of core dependency
   injection principles
 - [Intro to DICC][2] - basic introduction to DICC and how it was designed
   to work
 - [Services and dependencies][3] - how to write service definitions for the
   DICC compiler and how to specify dependencies
 - [Going live][4] - how to compile a container from the service definitions
   and how to use the container at runtime


## Contributing

If you find a bug, please feel free to file an issue, even if you can't provide
a pull request with a fix! Nobody will be shamed here for not having the time to
invest into fixing other people's code. I set this boat out to sea, so it's my
responsibility to keep it floating.

That said, I do welcome pull requests as well - whether they be bug fixes or
new features. There's no formal code style, if I have an issue with your
indentation or something, I'll just fix it.


[1]: https://github.com/jahudka/dicc/blob/main/docs/01-intro-to-di.md
[2]: https://github.com/jahudka/dicc/blob/main/docs/02-intro-to-dicc.md
[3]: https://github.com/jahudka/dicc/blob/main/docs/03-services-and-dependencies.md
[4]: https://github.com/jahudka/dicc/blob/main/docs/04-going-live.md
