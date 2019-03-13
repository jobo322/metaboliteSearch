const {parentPort, workerData} = require('worker_threads');
const processData = require('./process');
const request = require('request-promise');

async function update(workerData) {
    var {
        sample,
        baseURL,
        database,
        username,
        password,
        couchdb
    } = workerData;
    parentPort.postMessage(baseURL);
    data = await request({
        url: baseURL+ database + '/' + sample.id,
        method: 'GET',
        json: true
    });
    if (data.$content) {
        var nmrs = data.$content.spectra.nmr;
        var entry = data.$id[0];
        var id = data._id;
        var entryUrl = 'http://'+username+':'+password+'@'+ couchdb + '/' + database + '/';
        for (let nmr of nmrs) {
            var url = entryUrl + id + '/' + nmr.jcamp.filename;
            var nmrJcamp = await request({
                url: url,
                method: 'GET'
            });
            var processedData = processData(nmrJcamp);
            nmr.fitPeaks = [{
                functionName: 'pseudoVoigt',
                peaks: processedData.optPeaks.slice()
            }];
            nmr.normaFactor = processedData.normaFactor;
        }
    }
    await request({
        url: baseURL+'eln/'+sample.id,
        method: 'PUT',
        body: data,
        json: true
    });
    process.exit();
}

update(workerData);
