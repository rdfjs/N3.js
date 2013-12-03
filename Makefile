browser:
	@node browser/build.js

test:
	@./node_modules/mocha/bin/mocha

spec:
	@node spec/turtle-spec.js

spec-clean:
	@rm -r spec/turtle

perf:
	@./perf/N3Store-perf.js  $(dimension)
	@./perf/N3Lexer-perf.js  $(n3file)
	@./perf/N3Parser-perf.js $(n3file)

jshint:
	@./node_modules/jshint/bin/jshint lib perf test

docs:
	@./node_modules/.bin/docco lib/*.js

.PHONY: browser test spec perf jshint docs
