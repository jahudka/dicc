.PHONY: default
default: build

.PHONY: clean
clean:
	cd packages/dicc && make clean
	cd packages/cli && make clean

.PHONY: build
build:
	cd packages/dicc && make
	cd packages/cli && make

.PHONY: rebuild
rebuild:
	cd packages/dicc && make rebuild
	cd packages/cli && make rebuild

.PHONY: self-compile
self-compile:
	cd packages/cli && make compile

.PHONY: publish
publish:
	cd packages/dicc && make publish
	cd packages/cli && make publish
