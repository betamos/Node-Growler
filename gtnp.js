
var net = require('net');
var _ = require('underscore');
var crypto = require('crypto');
var fs = require('fs');

var nl = '\r\n', nl2 = nl+nl;

var GrowlApplication = function(name, options) {
  this.name = name;

  this.options = _.extend({
    host: 'localhost',
    port: 23053,
    applicationIcon: null,
    debug: false
  }, options);

  this.notifications = [];
  this.debug = false;
};

exports.GrowlApplication = GrowlApplication;

/**
 * Callback will get {Bool} status, {Error} error
 */
GrowlApplication.prototype.register = function(cb) {
  var queries = [], binaryQueries = [];
  var self = this;

  var q = this.header('REGISTER');
  q.push(
    'Application-Name: '+ this.name,
    'Notifications-Count: '+ this.notifications.length
  );

  if (this.options.applicationIcon) {
    fs.readFile(this.options.applicationIcon, null, function(err, buf) {
      if (err)
        throw err;

      var hash = crypto.createHash('md5');
      hash.update(buf);
      var digest = hash.digest();
      q.push('Application-Icon: x-growl-resource://'+ digest);
      binaryQueries.push({
        id: digest,
        buffer: buf
      });
      continueFn();
    });
  }
  else
    process.nextTick(continueFn);

  function continueFn() {
  
    queries.push(self.assembleQuery(q));

    _.each(self.notifications, function(not) {
      var q = [
        'Notification-Name: '+ not.name,
        'Notification-Display-Name: '+ not.displayName || not.name,
        'Notification-Enabled: True'
      ];
      queries.push(self.assembleQuery(q));
    });
    self.sendQuery(self.assembleQueries(queries), cb || function() {}, binaryQueries);
  };
};

GrowlApplication.prototype.sendNotification = function (name, title, string, cb, sticky) {
  var q = this.header('NOTIFY');
  q.push(
    'Application-Name: '+ this.name,
    'Notification-Name: '+ name,
    'Notification-Title: '+ title
  );
  string ? q.push('Notification-Text: '+ string) : null;
  sticky ? q.push('Notification-Sticky: True') : null;
  this.sendQuery(this.assembleQuery(q), cb || function() {});
}

GrowlApplication.prototype.addNotifications = function(notifications) {
  this.notifications = notifications;
};

GrowlApplication.prototype.header = function(messageType) {
  return [
    'GNTP/1.0 '+ messageType +' NONE',
    'X-Sender: nodejs GNTP Library'
  ];
};

/* PRIVATE STUFF */

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
  socket.connect(this.options.port, this.options.host, function() {
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
