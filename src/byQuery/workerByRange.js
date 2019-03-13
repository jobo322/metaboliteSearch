const {parentPort, workerData} = require('worker_threads');
const SD = require('spectra-data');
const {gsd} = require('ml-gsd');
const fs = require('fs');
const optimizePeaks = require('../optimizePeaks');
const request = require('request-promise');

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

var peaksToSearch = [
    {
        name: 'alanine',
        toFit: true,
        getIntegral: true,
        peak: [
            {
                delta: 1.4,
                width: 0.05,
                integral: 3
            }
        ],
        callback: function(peaks) {
            let len = peaks.length;
            for (let j = 0; j < len; j++) {
                for (let k = j + 1; k < len; k++) {
                    let d = Math.abs(peaks[k].x - peaks[j].x)
                    if (d <= 0.015 && d >= 0.012) {
                        if (Math.abs(peaks[k].y - peaks[j].y) <= 0.01) {
                            let area = peaks[k].y * peaks[k].width * sqrtPI * (peaks[k].xL + (1 - peaks[k].xL)*sqrtPI);
                            area += peaks[j].y * peaks[j].width * sqrtPI * (peaks[j].xL + (1 - peaks[j].xL)*sqrtPI);
                            let integral = 3*10*area/brukerRef*sum;
                            let delta = (peaks[k].x + peaks[j].x)/2
                            console.log('delta %s, integral: %s, acople: %s\n', delta, integral, d);
                            
                            candidates.push([peaks[k], peaks[j]]);
                        }
                    } else if (d > 0.015) {
                        break //following peak
                    }
                }
            }
        }
    },
    {
        name: 'lactate',
        toFit: true,
        getIntegral: true,
        peak: [
            {
                delta: 1.33,
                width: 0.07,
                integral: 3
            }
        ]
    },
    {
        name: 'BrukerRef',
        toFit: true,
        getIntegral: true,
        peak: [
            {
                delta: 12,
                width: 0.05,
                integral: 1
            }
        ]
    },
    {
        name: 'TMS',
        toFit: true,
        getIntegral: true,
        peak: [
            {
                delta: 0,
                width: 0.05,
                integral: 1
            }
        ]
    },
    {
        name: 'all',
        toFit:false,
        getIntegral: true,
        range: {
            from: 0.12,
            to: 11.95
        },
        peak: []
    },
    {
        name: 'formicAcid',
        toFit:true,
        getIntegral: true,
        peak: [
            {
                delta: 8.45,
                width: 0.05,
                integral: 1
            }
        ]
    },
    {
        name: 'creatinine3',
        toFit:true,
        getIntegral: true,
        peak: [
            {
                delta: 3.05,
                width: 0.05,
                integral: 3
            }
        ]
    },
    {
        name: 'creatinine4',
        toFit:true,
        getIntegral: true,
        peak: [
            {
                delta: 4.06,
                width: 0.05,
                integral: 2
            }
        ]
    },
    {
        name: 'noiseLevel',
        toFit:false,
        getIntegral: false,
        getSTD: true,
        getMean: true,
        range: {
            from: 13.5,
            to: 14
        },
        peak: []
    },
];

async function update(workerData) {
    var {
        samples,
        baseURL,
        database,
        username,
        password,
        couchdb
    } = workerData;
    var sqrtPI = workerData.sqrtPI;
    for (let i = 0; i < samples.length; i++) {
        if (i % 10 === 0) console.log(i);
        let sample = samples[i];
        data = await request({
            url: baseURL+ database + '/' + sample.id,
            method: 'GET',
            json: true
        });
        
        let toExport;
        try {
            var nmr = data.$content.spectra.nmr[0];
            var entry = data.$id[0];
            var id = data._id;
            var entryUrl = 'http://'+username+':'+password+'@'+ couchdb + '/' + database + '/';
            var url = entryUrl + id + '/' + nmr.jcamp.filename;
            var jcamp = await request({
                url: url,
                method: 'GET'
            });
            var spectrum = SD.NMR.fromJcamp(jcamp);
            spectrum.suppressRange(4.7,4.9);
            toExport = {'sampleid': entry.replace(/-/g, '_'), optPeaks: [], originalData: spectrum.getVector({from: -0.5, to: 12.5, nbPoints: 1024})};
            var noiseLevel = spectrum.getNoiseLevel({from: 13.5, to: 14}) * 3;
            options = Object.assign({}, defaultOptions, {noiseLevel});
            peaksToSearch.forEach((ps, i, table) => {
                let result = {};
                let range = {};
                if (ps.peak[0]) {
                    range.from = ps.peak[0].delta - ps.peak[0].width;
                    range.to = ps.peak[0].delta + ps.peak[0].width;
                } else if (ps.range) {
                    range = ps.range;
                }
                range = Object.assign({}, range, {outputX: true});
                
                let data = range.hasOwnProperty('from') ? spectrum.getVector(range) : spectrum.getSpectrumData();
                data.y.forEach((e,i,arr) => (arr[i] = Math.abs(e)));
                var optPeaks;
                if (ps.toFit) {
                    var peakList = gsd(data.x, data.y, options);
                    peakList = peakList.filter(p => p.y >= noiseLevel)
                    if (peakList.length === 0) throw new Error('there are some wrong with ' + ps.name + ' of ' + entry)
                    optPeaks = optimizePeaks(
                        peakList,
                        data.x,
                        data.y, 
                        options
                    );
                    toExport.optPeaks = toExport.optPeaks.concat(optPeaks);
                }
                if (ps.getIntegral) {
                    if (ps.toFit && ps.peak.length) {
                        let delta = ps.peak[0].delta;
                        let max = Number.MIN_SAFE_INTEGER;
                        let maxIndex = null;
                        optPeaks.forEach((e, i) => {
                            if (e.y > max) {
                                maxIndex = i;
                                max = e.y;
                            }
                        });
                        let peak = optPeaks[maxIndex];
                        result[ps.name+'-integral'] = peak.y * peak.width * sqrtPI * (peak.xL + (1 - peak.xL)*sqrtPI);
                        result[ps.name +'-delta'] = peak.x;
                    } else if (range.hasOwnProperty('from')) {
                        result[ps.name+'-integral'] = data.y.reduce((a,b) => a + b);
                    }
                }
                if (ps.getMean) {
                    let sum = null;
                    if (ps.getIntegral && !ps.toFit && range.hasOwnProperty('from')) {
                        sum = result.integral
                    } else {
                        sum = data.y.reduce((a,b) => a + b);
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
            fs.appendFileSync('dataProcessed600.json', JSON.stringify(toExport) + ',');   
        } catch(error) {
            parentPort.postMessage('the sample ' + samples[i].id + 'was not proccessed');
        }
    }
    process.exit();
}

update(workerData)
