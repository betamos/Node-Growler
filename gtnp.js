
var net = require('net');
var _ = require('underscore');

var nl = '\r\n', nl2 = nl+nl;

var GrowlApplication = function(name, host, port) {
  this.name = name;
  this.host = host || 'localhost';
  this.port = port || 23053;
  this.notifications = [];
  this.debug = false;
};

exports.GrowlApplication = GrowlApplication;

/**
 * Callback will get {Bool} status, {Error} error
 */
GrowlApplication.prototype.register = function(cb) {
  var self = this;

  var queries = [];

  var q =  [
    'GNTP/1.0 REGISTER NONE',
    'Connection: Keep-Alive',
    'Application-Name: '+ this.name,
    'Notifications-Count: '+ this.notifications.length];
  
  queries.push(this.assembleQuery(q));

  _.each(this.notifications, function(not) {
    var q = [
      'Notification-Name: '+ not.name,
      'Notification-Display-Name: '+ not.displayName || not.name,
      'Notification-Enabled: True'
    ];
    queries.push(self.assembleQuery(q));
  });
  this.sendQuery(this.assembleQueries(queries), cb);
};

GrowlApplication.prototype.sendNotification = function (name, title, string, cb) {
  var q = [
    'GNTP/1.0 NOTIFY NONE',
    'Connection: Keep-Alive',
    'Application-Name: '+ this.name,
    'Notification-Name: '+ name,
    'Notification-Title: '+ title
  ];
  string ? q.push('Notification-Text: '+ string) : null;
  this.sendQuery(this.assembleQuery(q), cb || function() {});
}

GrowlApplication.prototype.addNotifications = function(notifications) {
  this.notifications = notifications;
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
GrowlApplication.prototype.sendQuery = function(query, cb) {

  var socket = new net.Socket();
  socket.setEncoding('utf8');

  query += nl2;
  if (this.debug)
    console.log('Sending query:\n===\n'+ query +'\n===');
  socket.connect(this.port, this.host, function() {
    socket.write(query);
  });
  socket.once('data', function(data) {
    console.log(data);
    var response = /^GNTP\/1\.0\ \-(OK|ERROR)\ NONE\r\n/.exec(data);
    if (!response)
      cb(false, new Error('The response was incorrectly formatted'));
    else if (response[1] == 'ERROR')
      cb(false, new Error('The Growl client said that I did wrong :\'('));
    else // All good
      cb(true);
  });
  socket.once('close', function() {
    console.log('Closed by growl');
  });
};
