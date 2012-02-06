test:
	@./node_modules/.bin/vows

perf:
	@./perf/n3store-perf.js  $(dimension)
	@./perf/n3lexer-perf.js  $(n3file)
	@./perf/n3parser-perf.js $(n3file)

jshint:
	@jshint lib perf test

docs:
	@docco lib/*.js

.PHONY: test perf jshint docs
