const {parentPort, workerData} = require('worker_threads');
const SD = require('spectra-data');
const path = require('path');
const {gsd} = require('ml-gsd');
const fs = require('fs');
const airPLS = require('../airPLS');
const optimizePeaks = require('../optimizePeaks');
const defaultOptions = {
    thresholdFactor: 1,
    minMaxRatio: 0.001,
    broadRatio: 0.00025,
    smoothY: true,
    widthFactor: 4,
    realTop: false,
    functionName: 'voigt',
    broadWidth: 0.25,
    sgOptions: { windowSize: 15, polynomial: 3 }
};

let baseLineOptions = {
    factorCriterion: 0.001,
    lambda: 500,
    maxIterations: 100
}

var {
    index,
    samples,
    pathToData,
    pathInfo
} = workerData;

var {peaksToSearch} = require(pathInfo);
// console.log(peaksToSearch)
var sqrtPI = workerData.sqrtPI;
// parentPort.postMessage('sample length ' + samples.length);
for (let i = 0; i < samples.length; i++) {
    // if (i % 10 === 0) parentPort.postMessage(String(index) + ' - ' + i);
    let sample = samples[i];
    let entry = sample.replace(/\.[a-z]*/g, '');
    parentPort.postMessage(String(index) + ' ' + entry)
    let toExport;
    try {
        let pathToJcamp = path.join(pathToData, sample);
        var jcamp = fs.readFileSync(pathToJcamp, 'utf8');
        var spectrum = SD.NMR.fromJcamp(jcamp);
        spectrum.suppressRange(4.7,4.9);
        let dataY = spectrum.getYData();
        // console.log('dataY',dataY)
        // var sum = dataY.reduce((a,b) => a + b, 0);
        // dataY.forEach((e,i,arr) => (arr[i] = e /sum))
        var noiseLevel = spectrum.getNoiseLevel({from: 13.5, to: 14})
        var max = dataY.reduce((a,b) => {
            if (b > a) a = b
            return a
        }, Number.MIN_SAFE_INTEGER);
        dataY.forEach((e,i,arr) => (arr[i] = e/max))
        var weights = dataY.map(e => {
            if (e < 0) {
                return 0.001
            }
            return e
        });
        // baseLineOptions.weights = weights;
        // let baseLine = airPLS(dataY, baseLineOptions);
        // let isnan = baseLine.baseline.some(e => isNaN(e));
        // if (isnan) {
        //     parentPort.postMessage(String(entry) + ' has not good baseline result');
        //     return
        // }
        // baseLine.corrected.forEach((e,i,arr) => arr[i] = e * max);
        // spectrum.sd.spectra[0].data[0].y = baseLine.corrected;
        toExport = {'sampleid': entry.replace(/-/g, '_')};
        noiseLevel *= 3;
        options = Object.assign({}, defaultOptions, {noiseLevel}); 
        peaksToSearch.forEach((ps, i, table) => {
            // parentPort.postMessage(ps.name + ' is active? '+ ps.active)
            if (!ps.active) return
            let result = {};
            let range = {};
            if (ps.range) {
                range = ps.range;
            } else if (ps.peak[0]) {
                range.from = ps.peak[0].delta - ps.peak[0].width;
                range.to = ps.peak[0].delta + ps.peak[0].width;
            }
            range = Object.assign({}, range, {outputX: true});
            // parentPort.postMessage(String(entry) + ' ' + JSON.stringify(range))
            let data = range.hasOwnProperty('from') ? spectrum.getVector(range) : spectrum.getSpectrumData();
            // parentPort.postMessage(String(entry) + ' ' + data.y.length);

            data.y.forEach((e,i,arr) => (arr[i] = Math.abs(e)));
            var optPeaks;
            if (ps.toFit) {
                var peakList = gsd(data.x, data.y, options);
                if (peakList.length === 0) {
                    parentPort.postMessage(String(entry) + ' ' + JSON.stringify(range) + ' does not has peaks');
                    return
                }
                peakList = peakList.filter(p => p.y >= noiseLevel);
                if (peakList.length === 0) {
                    parentPort.postMessage(String(entry) + ' ' + JSON.stringify(range) + ' does not has peaks');
                    return
                }
                optPeaks = optimizePeaks(
                    peakList,
                    data.x,
                    data.y,
                    options
                );
                // parentPort.postMessage(String(entry) + 'pasa opt');
                result[ps.name + '-optPeaks'] = optPeaks;
            }
            if (ps.getIntegral) {
                if (ps.toFit && ps.peak.length) {
                    // parentPort.postMessage(String(entry) + JSON.stringify(optPeaks));
                    let selectedPeaks = ps.callback(optPeaks);
                    // parentPort.postMessage(String(entry) + 'pasa callback');
                    result[ps.name+'-integral'] = selectedPeaks.reduce((a,b) => {
                        let peak = b;
                        return peak.y * peak.width * sqrtPI * (1 - peak.xL + peak.xL*sqrtPI) + a;
                    }, 0);
                    result[ps.name + '-selected'] = selectedPeaks;
                    result[ps.name +'-delta'] = selectedPeaks.reduce((a,b) => a + b.x, 0) / selectedPeaks.length;
                } else if (range.hasOwnProperty('from')) {
                    result[ps.name+'-integral'] = data.y.reduce((a,b) => a + b, 0);
                }
            }
            // parentPort.postMessage(String(entry) + 'pasa integral');
            if (ps.getMean) {
                let sum = null;
                if (ps.getIntegral && !ps.toFit && range.hasOwnProperty('from')) {
                    sum = result.integral
                } else {
                    sum = data.y.reduce((a,b) => a + b, 0);
                }
                result[ps.name+'-mean'] = sum / data.y.length;
            }
            if (ps.getSTD) {
                let mean;
                if (ps.getMean) {
                    mean = result.mean;
                } else {
                    mean = data.y.reduce((a,b) => a + b, 0) / data.y.length;
                }
                let sumSquare = data.y.reduce((a,b) => a + Math.pow(mean - b, 2), 0);
                result[ps.name + '-std'] = Math.sqrt(sumSquare/data.y.length);
            }
            toExport = Object.assign({}, toExport, JSON.parse(JSON.stringify(result)));
        });
        // fs.appendFileSync('dataProcessedLocal' + index + '.json', JSON.stringify(toExport) + ',');   
        fs.appendFileSync('theSame.json', JSON.stringify(toExport) + ',');   
    } catch(err) {
        parentPort.postMessage(err);
        continue
    }
}
process.exit();

