// Known-failing tests of the W3C Notation3 test suites
// (https://w3c-cg.github.io/N3/tests/N3Tests/), skipped pending the linked issues.
// Prints the `--skip` regex for the suite name given as argument (parser or extended).

const skips = {
  parser: [
    // https://github.com/rdfjs/N3.js/issues/348 — resource path syntax (`!` and `^`)
    'cwm_includes_xsd.n3',
    'cwm_other_log-filter.n3',
    'cwm_syntax_path2.n3',

    // https://github.com/rdfjs/N3.js/issues/328 — literals (and formulae)
    // should be valid subjects and predicates in text/n3
    'cwm_includes_n3ExprFor.n3',
    'cwm_includes_t8.n3',
    'cwm_list_double.n3',
    'cwm_list_list-bug2-ref.n3',
    'cwm_list_r1-ref.n3',
    'cwm_os_argv.n3',
    'cwm_os_environ.n3',
    'cwm_string_endsWith.n3',
    'cwm_string_roughly.n3',
    'cwm_string_uriEncode-out.n3',
    'cwm_string_uriEncode.n3',
    'cwm_syntax_a1.n3',
    'cwm_syntax_bad-preds-formula.n3',
    'cwm_syntax_bad-preds-literal.n3',
    'cwm_time_t1.n3',

    // No issue yet — N3 documents may use the empty prefix without declaring it
    // (implicitly bound to <#>, a long-standing cwm/N3 convention;
    // see https://github.com/w3c-cg/N3/issues/82)
    'cwm_andy_D.n3',
    'cwm_i18n_n3string.n3',
    'cwm_includes_bnodeConclude.n3',
    'cwm_includes_builtins.n3',
    'cwm_includes_list-in.n3',
    'cwm_list_bnode_in_list_in_list.n3',
    'cwm_list_builtin_generated_match.n3',
    'cwm_list_unify5.n3',
    'cwm_other_anonymous_loop.n3',
    'cwm_other_filter-bnodes.n3',
    'cwm_reason_danc.n3',
    'cwm_reason_rename-loop.n3',
    'cwm_reason_single_gen.n3',
    'cwm_reason_timbl.n3',
    'cwm_supports_simple.n3',
    'cwm_syntax_base.n3',
    'cwm_syntax_boolean.n3',
    'cwm_syntax_decimal.n3',
    'cwm_syntax_equals1.n3',
    'cwm_syntax_equals2.n3',
    'cwm_syntax_formula-simple-1.n3',
    'cwm_syntax_formula-subject.n3',
    'cwm_syntax_neg-literal-predicate.n3',
    'cwm_syntax_too-nested.n3',
    'cwm_syntax_trailing-semicolon.n3',
    'cwm_syntax_zero-predicates.n3',
    'cwm_unify_unify1.n3',
    'extra_good_prefix.n3',
    'new_syntax_caret_pos.n3', // also `^` path on a literal (issue #348)
    'new_syntax_inverted_properties.n3', // also `<-` inverted predicates (no issue yet)

    // No issue yet — `has`/`is ... of` predicate keywords
    'cwm_includes_concat.n3',
    'cwm_includes_conclusion.n3',
    'cwm_list_append.n3',
    'cwm_list_last.n3',
    'cwm_math_math-test.n3',
    'cwm_other_dec-div.n3',
    'cwm_other_invalid-ex.n3',
    'cwm_other_schema-rules.n3',
    'cwm_other_smush-query.n3',

    // No issue yet — `[id <iri> ...]` IRI property lists
    'new_syntax_iriPropertyList_nested_resources.n3',
    'new_syntax_iriPropertyList_not_embedded.n3',
    'new_syntax_iriPropertyList_single_object.n3',
    'new_syntax_iriPropertyList_with_newline.n3',
    'new_syntax_iriPropertyList_with_whitespace.n3',

    // No issue yet — statements without a predicate–object list (`:a .`)
    'cwm_list_list-bug2.n3',

    // Upstream suite data issue — the expected output hardcodes the suite's
    // pre-move https://w3c.github.io/… base (the parsed quads are correct)
    'cwm_syntax_no-last-nl.n3',
    'cwm_syntax_path1.n3',
  ],
  extended: [
    // https://github.com/rdfjs/N3.js/issues/348 — resource path syntax (`!` and `^`)
    '01etc_easter.n3',
    '01etc_easterP.n3',
    '01etc_fib.n3',
    '01etc_mmln-plugin.n3',
    '01etc_pi.n3',
    '04test_alarmE.n3',
    '04test_danC.n3',
    '04test_danQ.n3',
    '04test_easterP.n3',
    '04test_gateE.n3',
    '04test_geneE.n3',
    '04test_gmpE.n3',
    '04test_grahamP.n3',
    '04test_michaelE.n3',
    '04test_sethE.n3',
    '04test_wetE.n3',
    '07test_bench.n3',
    '07test_easterP.n3',
    '07test_fib.n3',
    '07test_id.n3',
    '07test_pi.n3',

    // https://github.com/rdfjs/N3.js/issues/342 — graph terms in lists are dropped
    '07test_alpA001.n3',
    '07test_alpA010.n3',
    '07test_bd-test-10.n3',
    '07test_bd-test-100.n3',
    '07test_bd-test-1000.n3',
    '07test_idE.n3',
    '07test_pd_hes_theory.n3',
    '07test_sc.n3',
    '07test_shubert.n3',
    '07test_wetP100.n3',

    // https://github.com/rdfjs/N3.js/issues/328 — literals (and formulae)
    // should be valid subjects and predicates in text/n3
    '01etc_biP.n3',
    '01etc_cryptoP.n3',
    '01etc_palindrome-query.n3',
    '01etc_palindrome2-query.n3',
    '07test_biE.n3',
    '07test_biP.n3',
    '07test_cryptoE.n3',
    '07test_cryptoP.n3',
    '07test_ttl-to-rdfa.n3',

    // No issue yet — implicit empty prefix (see the parser suite note above)
    '01etc_iq-extra.n3',
    '07test_badmeta.n3',

    // https://github.com/rdfjs/N3.js/issues/351 — too lenient on string escapes
    // (negative test that the parser accepts)
    '04test_query-survey-10.n3',
  ],
};

process.stdout.write(`#(${skips[process.argv[2]].join('|')})$`);
