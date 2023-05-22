.PHONY: default
default: build

.PHONY: clean
clean:
	cd packages/dicc && make clean
	cd packages/dicc-compiler && make clean

.PHONY: build
build:
	cd packages/dicc && make
	cd packages/dicc-compiler && make

.PHONY: rebuild
rebuild:
	cd packages/dicc && make rebuild
	cd packages/dicc-compiler && make rebuild

.PHONY: self-compile
self-compile:
	cd packages/dicc-compiler && make compile

.PHONY: publish
publish:
	cd packages/dicc && make publish
	cd packages/dicc-compiler && make publish
