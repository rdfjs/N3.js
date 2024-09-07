const N3 = require('../../lib');
const fs = require('fs');
const path = require('path');

const { quad, namedNode, literal } = N3.DataFactory;
const dim = 30;

const writer = new N3.StreamWriter();
fs.rmSync(path.join(__dirname, 'data.trig'), { force: true });
const outputStream = fs.createWriteStream(path.join(__dirname, 'data.trig'));
writer.pipe(outputStream);

const prefix = 'http://example.org/#';
for (let i = 0; i < dim; i++) {
  for (let j = 0; j < dim; j++) {
    for (let k = 0; k < dim; k++) {
      for (let l = 0; l < dim; l++) {
        writer.write(quad(
          namedNode(prefix + i), namedNode(prefix + j), (k % 2 === 0 ? namedNode : literal)(prefix + k), namedNode(prefix + l)
        ));
      }
    }
  }
}

writer.end();