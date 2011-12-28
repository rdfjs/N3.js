test:
	@./node_modules/.bin/vows

perf:
	@./perf/*-perf.js

.PHONY: test perf
