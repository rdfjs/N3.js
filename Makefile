browser:
	@./browser/build-browser-versions

test:
	@./node_modules/mocha/bin/mocha

coverage:
	@./node_modules/istanbul/lib/cli.js cover node_modules/mocha/bin/_mocha -- -R spec --timeout 100

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

.PHONY: browser test coverage spec perf jshint docs
