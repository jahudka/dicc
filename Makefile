.PHONY: default
default: dist

.PHONY: rebuild
rebuild: clean dist

.PHONY: clean
clean:
	rm -rf dist

.PHONY: tests
tests:
	jest

.PHONY: all
all: rebuild tests

.PHONY: compile
compile:
	dist/cli/cli.js -p tsconfig.json -i src/cli/definitions.ts -o src/cli/container.ts

dist:
	node_modules/.bin/tsc
	chmod +x dist/cli/cli.js
