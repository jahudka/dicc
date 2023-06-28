.PHONY: default
default: dist

.PHONY: rebuild
rebuild: clean dist

.PHONY: clean
clean:
	rm -rf dist

.PHONY: compile
compile:
	dist/cli.js

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
	cp ../../readme.md ./
	../../node_modules/.bin/is-published || npm publish
