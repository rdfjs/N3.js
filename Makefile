test:
	@./node_modules/.bin/vows

perf:
	@./perf/*-perf.js

jshint:
	@jshint lib perf test

docs:
	@docco lib/*.js

.PHONY: test perf jshint docs
