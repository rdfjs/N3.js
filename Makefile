test:
	@./node_modules/.bin/vows

perf:
	@./perf/*-perf.js

jshint:
	@jshint lib perf test

.PHONY: test perf jshint
