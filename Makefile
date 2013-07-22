test:
	@./node_modules/.bin/vows test/*-test.js

spec:
	@node spec/turtle-spec.js

spec-clean:
	@rm -r spec/turtle

perf:
	@./perf/n3store-perf.js  $(dimension)
	@./perf/n3lexer-perf.js  $(n3file)
	@./perf/n3parser-perf.js $(n3file)

jshint:
	@./node_modules/jshint/bin/jshint lib perf test

docs:
	@./node_modules/.bin/docco lib/*.js

.PHONY: test spec perf jshint docs
