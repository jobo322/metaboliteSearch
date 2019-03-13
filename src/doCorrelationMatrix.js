const fs = require('fs');
const path = require('path');
const {Matrix} = require('ml-matrix');
const brukerPath = path.resolve(path.join('matrixNormalized.json'));
var data = fs.readFileSync(brukerPath, 'utf8');
data = JSON.parse('{"data":['.concat(data.slice(0, data.length - 1), ']}'));
var matrix = new Matrix(data.data);
var transpose = matrix.transpose();
var factor = 1 / (1024 - 1);
// var correlation = transpose.mmul(matrix)
// var correlation = correlation.mulS(factor);

// fs.writeFileSync('stocsy.json', JSON.stringify(correlation.to2DArray()))
