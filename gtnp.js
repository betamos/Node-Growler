
var net = require('net');
var _ = require('underscore');
var crypto = require('crypto');

var nl = '\r\n', nl2 = nl+nl;

var GrowlApplication = function(applicationName, options) {
  this.name = applicationName;

  this.options = _.extend({
    hostname: 'localhost',
    port: 23053,
    applicationIcon: null, // Buffer
    debug: false,
    additionalHeaders: ['X-Sender: Node.js GNTP Library'] // Send on every request
  }, options);

  this.notifications = [];
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
    'Notifications-Count: '+ this.notifications.length
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

  _.each(this.notifications, function(not) {
    var q = [
      'Notification-Name: '+ not.name,
      'Notification-Display-Name: '+ not.displayName || not.name,
      'Notification-Enabled: True'
    ];
    queries.push(self.assembleQuery(q));
  });
  self.sendQuery(self.assembleQueries(queries), callback || function() {}, binaryQueries);
};

GrowlApplication.prototype.sendNotification = function (notificationName, options) {
  var notification = _.find(this.notifications, function(not) {
    return not.name == notificationName;
  });
  options = _.extend({
    title: notification.displayName,
    text: '',
    callback: function() {},
    sticky: false
  }, options);
  console.log(options);

  var q = this.header('NOTIFY').concat(
    'Notification-Name: '+ notification.name,
    'Notification-Title: '+ options.title,
    'Notification-Text: '+ options.text,
    'Notification-Sticky: '+ (options.sticky ? 'True' : 'False')
  );
  this.sendQuery(this.assembleQuery(q), options.callback);
};

GrowlApplication.prototype.addNotifications = function(notifications) {
  this.notifications = _.map(notifications, function(not) {
    not.displayName = not.displayName || not.name; // Set display name
    return not;
  });
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
    if (self.options.debug)
      console.log(data.toString());
    var response = /^GNTP\/1\.0\ \-(OK|ERROR)\ NONE\r\n/.exec(data);
    if (!response)
      cb(false, new Error('The response was incorrectly formatted'));
    else if (response[1] == 'ERROR')
      cb(false, new Error('The Growl client said that I did wrong :\'('));
    else // All good
      cb(true);
  });
  socket.once('close', function() {
    if (self.options.debug)
      console.log('Closed by growl');
  });
};
