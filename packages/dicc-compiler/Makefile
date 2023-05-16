.PHONY: default
default: dist

.PHONY: rebuild
rebuild: clean dist

.PHONY: clean
clean:
	rm -rf dist

.PHONY: compile
compile:
	dist/cli.js -i src/definitions.ts -o src/container.ts

dist:
	../../node_modules/.bin/tsc
	chmod +x dist/cli.js
