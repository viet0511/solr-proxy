var Code = require('code'); 

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var expect = Code.expect;
var describe = lab.experiment;
var it = lab.test;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;

var http = require('http');
var net = require('net');
var request = require('request');

var SolrProxy = require('../index.js');

var createSolrTestDouble = function (responseCode) {
    var server = http.createServer(function(req, res) {
        res.writeHead(responseCode);
        res.end();
    });
    return server.listen(8080);
};

var checkResponseCode = function (url, expectedCode, done) {
    request
        .get(url)
        .on('response', function (response) {
            expect(response.statusCode).to.equal(expectedCode);
            done();
        });
};

describe('exports', function () {
    it('should expose a start function', function (done) {
        expect(typeof SolrProxy.start).to.equal('function');
        done();
    });
});

describe('start()', function () {
    var proxy;
    var solrTestDouble;

    beforeEach(function (done) {
        solrTestDouble = createSolrTestDouble(200);
        done();
    });

    afterEach(function (done) {
        proxy.close();
        solrTestDouble.close();
        done();
    });

    it('should start a proxy on specified port if port is specified', function (done) {
        proxy = SolrProxy.start(9999);
        checkResponseCode('http://localhost:9999/solr/select?q=fhqwhagads', 200, done);
    });

    it('should not start a proxy on the default port if a different port is specified', function (done) {
        proxy = SolrProxy.start(9999);

        request
        .get('http://localhost:8008/solr/select?q=fhqwhagads')
        .on('error', function (err) {
            expect(err.code).to.equal('ECONNREFUSED');
            done();
        });
    });

    it('should use options if specified', function (done) {
        proxy = SolrProxy.start(null, {validPaths: '/come/on'});
        checkResponseCode('http://localhost:8008/come/on?q=fhqwhagads', 200, done);
    });
});

describe('proxy server', function () {
    var proxy;
    var solrTestDouble;

    beforeEach(function (done) {
        proxy = SolrProxy.start();
        done();
    });

    afterEach(function (done) {
        proxy.close();
        if (solrTestDouble.close) {
            solrTestDouble.close();
        }
        done();
    });

    it('should return 502 on proxy error', function (done) {
        var server = net.createServer(function(c) {
            c.write('abc\r\n');
            c.end();
        });
        solrTestDouble = server.listen(8080);
        checkResponseCode('http://localhost:8008/solr/select?q=fhqwhagads', 502, done);
    });

    it('should return 200 for a valid request', function (done) {
        solrTestDouble = createSolrTestDouble(200);
        checkResponseCode('http://localhost:8008/solr/select?q=fhqwhagads', 200, done);
    });

    it('should return 403 on POST requests', function (done) {
        solrTestDouble = createSolrTestDouble(200);

        request
        .post('http://localhost:8008/solr/select?q=fhqwhagads')
        .on('response', function (response) {
            expect(response.statusCode).to.equal(403);
            done();
        });
    });

    it('should return 403 on requests for /solr/admin', function (done) {
        solrTestDouble = createSolrTestDouble(200);
        checkResponseCode('http://localhost:8008/solr/admin', 403, done);
    });

    it('should return 403 on request with qt parameter', function (done) {
        solrTestDouble = createSolrTestDouble(200);
        checkResponseCode('http://localhost:8008/solr/select?q=fhqwhagads&qt=%2Fupdate', 403, done);
    });

    it('should return 403 on request with stream.url parameter', function (done) {
        solrTestDouble = createSolrTestDouble(200);
        checkResponseCode('http://localhost:8008/solr/select?q=fhqwhagads&stream.url=EVERYBODYTOTHELIMIT!', 403, done);
    });
});