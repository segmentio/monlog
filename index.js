
/**
 * Module dependencies.
 */

var responseTime = require('koa-response-time');
var assert = require('http-assert');
var monquery = require('monquery');
var route = require('koa-route');
var json = require('koa-json');
var parse = require('co-body');
var koa = require('koa');
var logs = require('./db');

/**
 * Application.
 */

var app = module.exports = koa();

// middleware

app.use(json());
app.use(responseTime());
app.use(count());

// routes

app.use(route.get('/stats', stats));
app.use(route.get('/', search));
app.use(route.post('/', create));

// hit ticker

var hits = 0;
setInterval(function(){
  var now = new Date;
  console.log('%s - calls: %d', now.toUTCString(), hits);
  hits = 0;
}, 5000);

/**
 * GET stats.
 */

function *stats() {
  this.body = yield {
    count: logs.count({})
  };
}

/**
 * GET to query logs with monquery.
 *
 * Query:
 *
 *  - `limit` response limit [20]
 *  - `fields` response fields
 */

function *search() {
  var body = yield text(this);
  var query = body ? monquery(body) : {};
  this.body = yield logs.find(query, options(this));
}

/**
 * POST to create a log.
 */

function *create() {
  var body = yield parse(this);

  assert(body.timestamp, 400, '.timestamp required');
  assert(body.hostname, 400, '.hostname required');
  assert(body.message, 400, '.message required');
  assert(body.level, 400, '.level required');
  assert(body.type, 400, '.type required');

  yield logs.insert(body, { safe: false });

  this.status = 201;
}

/**
 * Search response options.
 */

function options(ctx) {
  return {
    limit: limit(ctx),
    fields: fields(ctx)
  }
}

/**
 * Return limit.
 */

function limit(ctx) {
  return ctx.query.limit || 20;
}

/**
 * Return fields.
 */

function fields(ctx) {
  if (ctx.query.fields) return ctx.query.fields.split(',');
}

/**
 * Count hits.
 */

function count() {
  return function *(next){
    ++hits;
    yield next;
  }
}

/**
 * Buffer request.
 */

function text(ctx) {
  return function(fn){
    var buf = '';
    ctx.req.setEncoding('utf8');
    ctx.req.on('data', function(d){ buf += d });
    ctx.req.on('end', function(){
      fn(null, buf);
    });
  }
}
