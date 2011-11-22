
var gtnp = require('./gntp'),
    fs = require('fs'),
    crypto = require('crypto'),
    buffer = require('buffer'),
    net = require('net');

var myapp = new gtnp.GrowlApplication('Shit Head', {
  //hostname: '192.168.0.15',
  debug: true,
  //password: 'bacon',
  hashAlgorithm: 'sha256',
  //icon: fs.readFileSync('./volcano.jpg')
});

/*
var server = net.createServer(function(socket) {
  //socket.on('data', function() {});
});

//server.listen(1337);
*/

myapp.addNotifications({
  'Egg Shat': {},
  'Fart': {
    enabled: true,
    displayName: 'A fart just occured',
    icon: fs.readFileSync('./volcano.jpg'),
  }
});

myapp.register(function(status, err) {
  if (!status)
    throw err;

  console.log('registration accepted.');

   myapp.sendNotification('Fart', {
    callback: function(status, err) {
      if (!status)
        throw err;
      else
        console.log('Fantastic! The message was totally delivered.');
    }
  });

  myapp.sendNotification('Egg Shat', {
    text: 'Bacon egg är gott',
    sticky: true,
    icon: fs.readFileSync('ansikte.jpg'),
    callback: function(status, err) {
      if (!status)
        throw err;
      else
        console.log('Fantastic! This message was totally delivered.');
    }
  });
  
});
