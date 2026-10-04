export function escapeRegex(regex) {
  return regex.replace(/[\]\/\(\)\*\+\?\.\\\$]/g, '\\$&');
}

// Words with a fixed meaning in the grammar, which cannot name an additional directive
const reservedDirectiveNames = /^(?:prefix|base|version|graph|forsome|forall|iri|a|true|false|has|is|of|id)$/i;

// ### `checkDirectiveName` throws if the name cannot be used for an additional directive
export function checkDirectiveName(name) {
  if (!/^[a-z]+$/i.test(name) || reservedDirectiveNames.test(name))
    throw new Error(`Invalid directive name: "${name}"`);
}
