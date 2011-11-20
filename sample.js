
var gtnp = require('./gtnp'),
    fs = require('fs'),
    net = require('net');

var myapp = new gtnp.GrowlApplication('Shit Head', {
//  hostname: '192.168.0.11',
  debug: true,
  applicationIcon: fs.readFileSync('./volcano.jpg'),
});

/*
var server = net.createServer(function(socket) {
  //socket.on('data', function() {});
});

//server.listen(1337);
*/

myapp.addNotifications([{
    name: 'Egg Shat'
  }, {
    name: 'Fart',
    enabled: true,
    displayName: 'A fart just occured'
  }]);

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

  /*myapp.sendNotification('Egg Shat', {
    text: 'Bacon egg är gott',
    sticky: false,
    callback: function(status, err) {
      if (!status)
        throw err;
      else
        console.log('Fantastic! This message was totally delivered.');
    }
  });*/
  
});
