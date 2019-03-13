'use scrict';

const SD = require('spectra-data');
const optimizePeaks = require('./optimizePeaks');

const defaultOptions = {
    thresholdFactor: 1,
    minMaxRatio: 0.01,
    broadRatio: 0.00025,
    smoothY: true,
    widthFactor: 4,
    realTop: false,
    functionName: 'voigt',
    broadWidth: 0.25,
    sgOptions: { windowSize: 15, polynomial: 3 }
};

function process(jcamp, options = {}) {
    var sd = SD.NMR.fromJcamp(jcamp);
    var data = sd.getSpectrumData();
    let normaFactor = 100/data.y.reduce((a,b) => a + b, 0);
    data.y.forEach((e, i , arr) => (arr[i] *= normaFactor));
    sd.sd.spectra[0].data[0].y = data.y;
    var noiseLevel = sd.getNoiseLevel({from: 13.5, to: 14});
    options = Object.assign({}, defaultOptions, {noiseLevel});
    var peakList = sd.createPeaks(options);
    peakList = peakList.filter(p => p.y >= noiseLevel * 3);
    var optPeaks = optimizePeaks(
        peakList,
        data.x,
        data.y, 
        options
    );
    return {optPeaks, normaFactor};
}

module.exports = process;
