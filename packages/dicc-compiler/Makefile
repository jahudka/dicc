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

.PHONY: major-release
major-release:
	npm version --no-git-tag-version major

.PHONY: minor-release
minor-release:
	npm version --no-git-tag-version minor

.PHONY: patch-release
patch-release:
	npm version --no-git-tag-version patch

.PHONY: publish
publish:
	../../node_modules/.bin/is-published || npm publish
