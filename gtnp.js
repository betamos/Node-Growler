
var net = require('net');
var _ = require('underscore');
var crypto = require('crypto');

var nl = '\r\n', nl2 = nl+nl;

var GrowlApplication = function(applicationName, options) {
  this.name = applicationName;
  this.options = options;

  _.defaults(options, {
    hostname: 'localhost',
    port: 23053,
    timeout: 5000, // Socket inactivity timeout
    applicationIcon: null, // Buffer
    debug: false,
    additionalHeaders: ['X-Sender: Node.js GNTP Library'] // Send on every request
  });

  this.notifications = {};
  this.debug = false;
};

exports.GrowlApplication = GrowlApplication;


/**
 * Callback will get {Bool} status, {Error} error
 */
GrowlApplication.prototype.register = function(callback) {
  var queries = [], binaryQueries = [];
  var self = this;

  var q = this.header('REGISTER');
  q.push(
    'Notifications-Count: '+ _.keys(this.notifications).length
  );

  if (Buffer.isBuffer(this.options.applicationIcon)) {
    var hash = crypto.createHash('md5');
    hash.update(this.options.applicationIcon);
    var digest = hash.digest('hex');
    q.push('Application-Icon: x-growl-resource://'+ digest);
    binaryQueries.push({
      id: digest,
      buffer: this.options.applicationIcon
    });
  }

  queries.push(self.assembleQuery(q));

  _.each(this.notifications, function(options, name) {
    var q = [
      'Notification-Name: '+ name,
      'Notification-Display-Name: '+ options.displayName || name,
      'Notification-Enabled: '+ (options.enabled ? 'True' : 'False')
    ];
    queries.push(self.assembleQuery(q));
  });
  self.sendQuery(self.assembleQueries(queries), callback || function() {}, binaryQueries);
};

GrowlApplication.prototype.sendNotification = function (name, options) {

  var not = this.notifications[name];

  options = _.extend({
    title: not.displayName,
    text: '',
    callback: function() {},
    sticky: false
  }, options);

  var q = this.header('NOTIFY').concat(
    'Notification-Name: '+ name,
    'Notification-Title: '+ options.title,
    'Notification-Text: '+ options.text,
    'Notification-Sticky: '+ (options.sticky ? 'True' : 'False')
  );
  this.sendQuery(this.assembleQuery(q), options.callback);
};

GrowlApplication.prototype.addNotifications = function(notifications) {
  _.each(notifications, function(options, name) {
    _.defaults(options, {
      displayName: name, // Set display name
      enabled: true // Enabled by default
    });
  });
  this.notifications = notifications;
  console.log(notifications);
};

/* PRIVATE STUFF */

GrowlApplication.prototype.header = function(messageType) {
  return [
    'GNTP/1.0 '+ messageType +' NONE'
  ].concat(this.options.additionalHeaders, 'Application-Name: '+ this.name);
};

/**
 * lines: An array of lines
 */
GrowlApplication.prototype.assembleQuery = function(lines) {
  return lines.join(nl);
};

/**
 * Assemble multiple queries for sending.
 */
GrowlApplication.prototype.assembleQueries = function(queries) {
  return queries.join(nl2);
};

/**
 * Send a query and wait for response, then call callback with cb({Boolean} status, {Error|Null} err)
 */
GrowlApplication.prototype.sendQuery = function(query, cb, binaryQueries) {
  var self = this;
  var socket = new net.Socket();
  socket.setEncoding('utf8');

  if (this.options.debug)
    console.log('Sending query:\n===\n'+ query +'\n===');
  socket.connect(this.options.port, this.options.hostname, function() {
    socket.write(query);
    _.each(binaryQueries, function(bin) {
      socket.write(nl2 +'Identifier: '+ bin.id + nl +'Length: '+ bin.buffer.length + nl2);
      socket.write(bin.buffer);
    });
    socket.write(nl2);
  });
  socket.once('data', function(data) {
    socket.destroy();
    if (self.options.debug)
      console.log(data.toString());
    var response = self.parseResponse(data);
    if (response && response.status) // All good
      cb(true);
    else if (response) { // GTNP responded with error
      var e = new Error('Host: '+
        (response.headers['Error-Description'] ? response.headers['Error-Description'] : ''));

      e.errorCode = response.headers['Error-Code'];
      cb(false, e);
    }

    else // Not even valid GTNP
      cb(false, new Error('The response was invalid GTNP.'));
  });

  // Exception management
  socket.on('error', function(exception) {
    // Could probably not connect to server
    cb(false, exception);
  });
  socket.setTimeout(this.options.timeout, function() {
    socket.destroy();
    cb(false, new Error('Server did not respond'));
  });
};


/**
  Parses and returns a raw response into an object which looks like this:
  {
    status: true, // OK | ERROR => true | false
    headers: {
      'Response-Action': 'NOTIFY',
      'Error-Code': '402'
    }
  }
  or null if the GNTP information line is malformed.
  Ignores lines that are not key: value structured
 */
GrowlApplication.prototype.parseResponse = function(data) {
  var lines = data.split('\r\n'),
    matches;

  // Check for valid GNTP header
  if (!(lines.length &&
        (matches = /^GNTP\/1\.0\ \-(OK|ERROR)\ NONE$/.exec(lines.shift())) &&
        matches.length == 2))
    return null; // Invalid, return null

  var status = matches[1] == 'OK';
  var headers = {};
  _(lines).chain()
    .filter(function(line) { return /^.+:\s.*$/.test(line); })
    .map(function(line) {
      // Match key: value pair
      var matches = /^(.+):\s(.*)$/.exec(line);
      if (!matches || matches.length < 3)
        throw new Error('GTNP Module internal error')

      headers[matches[1]] = matches[2];
    })
    .value(); // End chain
  return {
    status: status,
    headers: headers
  };
};
