
var net = require('net');

var nl = '\r\n', nl2 = nl+nl;

var GrowlApplication = function(name, host, port) {
  this.name = name;
  this.host = host || 'localhost';
  this.port = port || 23053;
  this.notifications = {};
  this.socket = new net.Socket();
  this.socket.setEncoding('utf8');
};

exports.GrowlApplication = GrowlApplication;

/**
 * Callback will get {Bool} status, {Error} error
 */
GrowlApplication.prototype.register = function(cb) {
  var request =  [
    'GNTP/1.0 REGISTER NONE',
    'Application-Name: '+ this.name,
    'Notifications-Count: '+ this.notifications.length];
  var query = this.assembleQuery(request);
  this.sendQuery(query, cb);
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
GrowlApplication.prototype.sendQuery = function(query, cb) {
  var self = this;
  this.socket.connect(this.port, this.host, function() {
    self.socket.write(query + nl2);
  });
  this.socket.once('data', function(data) {
    var response = /^GNTP\/1\.0\ \-(OK|ERROR)\ NONE\r\n/.exec(data);
    if (!response)
      cb(false, new Error('The response was incorrectly formatted'));
    else if (response[1] == 'ERROR')
      cb(false, new Error('The Growl client said that I did wrong :\'('));
    else // All good
      cb(true);
  });
};

var notify = [
  'GNTP/1.0 NOTIFY NONE',
  'Application-Name: Bacon Notifier',
  'Notification-Name: Download Complete',
  'Notification-Title: Bacon is coming our way',
  'Notification-String: Did you know bacon is very healthy?'
].join(nl) +nl+nl;
