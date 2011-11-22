
var util = require('util');
var net = require('net');
var crypto = require('crypto');
var _ = require('underscore');

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
    additionalHeaders: {'X-Sender': 'Node.js GNTP Library'}, // Send on every request TODO: not merged
    encryption: false,
    hashAlgorithm: 'sha1',
    password: null
  });

  this.notifications = {};
  this.debug = false;
};

exports.GrowlApplication = GrowlApplication;


/**
 * Callback will get {Bool} status, {Error} error
 */
GrowlApplication.prototype.register = function(callback) {

  var q = {
    messageType: 'REGISTER',
    headers: [{
      'Application-Name': this.name,
      'Notifications-Count': _.keys(this.notifications).length,
      'Application-Icon': this.options.applicationIcon
    }]
  };
  _.each(this.notifications, function(options, name) {
    q.headers.push({
      'Notification-Name': name,
      'Notification-Display-Name': options.displayName || name,
      'Notification-Enabled': !!options.enabled
    });
  });

  this.sendQuery(q, callback || function() {});
};

/**
 * Send a notification to the host.
 *
 * @param {string} name Notification name, must have already been added to the
 *   GrowlApplication object. Throws an error if it doesn't exist.
 *
 * @param {Object=} options
 *   Additional options object with the following optional keys:
 *   - title: Title of the message on the screen, visible to user.
 *   - text: Message text, visible to the user.
 *   - callback: Called when response is recieved from the host.
 *   - sticky: Makes sure notification stays on screen until clicked or dismissed.
 */
GrowlApplication.prototype.sendNotification = function (name, options) {

  var notification = this.notifications[name];
  if (!notification)
    throw new Error('Cannot find notification with name <'+ name +'>');

  _.defaults(options, {
    title: notification.displayName,
    text: '',
    callback: function() {}, // Called when a response is recieved
    sticky: false, // Stay on screen until clicked
    priority: 0, // In range [-2, 2], 2 meaning emergency
    icon: null
  });

  this.sendQuery({
    messageType: 'NOTIFY',
    headers: {
      'Application-Name': this.name,
      'Notification-Name': name,
      'Notification-Title': options.title,
      'Notification-Text': options.text,
      'Notification-Sticky': !!options.sticky,
      'Notification-Priority': options.priority,
      'Notification-Priority': options.icon // Note that if null (default), this header will be omitted
    }
  }, options.callback);

};

GrowlApplication.prototype.addNotifications = function(notifications) {
  _.each(notifications, function(options, name) {
    _.defaults(options, {
      displayName: name, // Set display name
      enabled: true // Enabled by default
    });
  });
  this.notifications = notifications;
};

/* PRIVATE STUFF */

GrowlApplication.prototype.hashHead = function() {
  // Need to check for type since an empty string is a valid password
  if (typeof this.options.password != 'string')
    return '';

  var salt = crypto.randomBytes(16),
    hash = crypto.createHash(this.options.hashAlgorithm),
    key, keyHash, hashHead;

  hash.update(this.options.password);
  hash.update(salt);
  // The key is pass+salt hashed
  key = hash.digest();
  // Create a new hash object
  hash = crypto.createHash(this.options.hashAlgorithm);
  // Yo dawg, we put a hash in yo hash
  hash.update(key);
  // Retrieve the final hash (digest) in hex form
  keyHash = hash.digest('hex');
  hashHead = this.options.hashAlgorithm +':'+ keyHash +'.'+ salt.toString('hex');
  // Actually, GNTP only requires the algorithm id (e.g. sha1) to be uppercase
  // but their example GNTP information lines are all uppercase so better be safe.
  return ' '+ hashHead.toUpperCase();
};

/**
 * Assemble a query into a buffer that is ready to be sent.
 * One possible side effect is that the query object may be altered.
 *
 * @param {Object} query
 *   An object with the keys:
 *   - messageType: The GNTP message type, e.g. "NOTIFY"
 *   - headers: An object with header-names as keys and each value is one of:
 *     - string: (GNTP <string>)
 *     - number: (GNTP <int>) Will run through parseInt to assure integer
 *     - boolean: (GNTP <boolean>) Must be true or false, no tricks
 *     - Buffer: for sending binary data, e.g. an image
 *     - null: omits the entire header
 *
 * @return {Object} An object with the keys:
 *   - message: {string} The message, does NOT begin nor end with CRLF
 *   - attachments: {Object} Keys: {string} GNTP <uniqueid>, Values: {Buffer}
 */
GrowlApplication.prototype.assembleQuery = function(query) {
  var self = this;
  var infoLine = 'GNTP/1.0 '+ query.messageType +' NONE' + this.hashHead();
  var blocks = []; // TODO: String performance
  var attachments = {}; // An object with <uniqueid> as keys and buffers as values
  if (!util.isArray(query.headers))
    query.headers = [query.headers]; // Convert to an array
  _.each(query.headers, function(header, index) {
    var lines = [];
    if (index == 0) {
      // First line in first block is always infoLine
      lines.push(infoLine);
      // Additional headers only once
      _.defaults(header, self.options.additionalHeaders);
    }
    _.each(header, function(value, key) {
      if (typeof key != 'string' || value == null)
        return;
  
      // Special case for buffers, they will be treated as attachments
      if (Buffer.isBuffer(value)) {
        // Create an md5 hash of the buffer
        var hash = crypto.createHash('md5');
        hash.update(value);
        var digest = hash.digest('hex');
        // Add to binary
        attachments[digest] = value;
        // Point to the binary attachment and alter value
        value = 'x-growl-resource://'+ digest;
      }
  
      // Alter value so that it is completely GNTP safe
      switch (typeof value) {
      case 'string':
        break;
      case 'number':
        value = parseInt(value);
        if (isNaN(value))
          return;
        break;
      case 'boolean':
        value = value ? 'True' : 'False';
        break;
      default:
        return;
      }
      // If everything worked out, add the line
      lines.push(key +': '+ value);
    });
    blocks.push(lines.join(nl));
  });
  return {
    message: blocks.join(nl2),
    attachments: attachments
  };
};

/**
 * Send a query and wait for response, then call callback with cb({Boolean} status, {Error|Null} err)
 */
GrowlApplication.prototype.sendQuery = function(query, cb) {
  var self = this;
  var socket = new net.Socket();
  socket.setEncoding('utf8'); // Response will be a string instead of buffer

  // Retrieve the data that shall be sent
  var data = this.assembleQuery(query);

  if (this.options.debug)
    console.log(data.message);

  // Connect
  socket.connect(this.options.port, this.options.hostname, function() {
    socket.write(data.message);
    _.each(data.attachments, function(buffer, uniqueid) {
      socket.write(nl2 +'Identifier: '+ uniqueid + nl +'Length: '+ buffer.length + nl2);
      socket.write(buffer);
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
    else if (response) { // GNTP responded with error
      var e = new Error('Host: '+
        (response.headers['Error-Description'] ? response.headers['Error-Description'] : ''));

      e.errorCode = response.headers['Error-Code'];
      cb(false, e);
    }

    else // Not even valid GNTP
      cb(false, new Error('The response was invalid GNTP.'));
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
  var lines = data.split(nl),
    matches;

  // Check for valid GNTP header
  if (!(lines.length &&
        (matches = /^GNTP\/1\.0\ \-(OK|ERROR)\ NONE\s*$/.exec(lines.shift())) &&
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
        throw new Error('GNTP Module internal error');

      headers[matches[1]] = matches[2];
    })
    .value(); // End chain
  return {
    status: status,
    headers: headers
  };
};
