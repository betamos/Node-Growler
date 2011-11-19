
var gtnp = require('./gtnp'),
    fs = require('fs');

var myapp = new gtnp.GrowlApplication('Shit Head', {
//  hostname: '192.168.0.11',
  debug: true,
  applicationIcon: fs.readFileSync('./volcano.jpg')
});

myapp.debug = true;

myapp.addNotifications([
  {
    name: 'Egg Shat',
    enabled: false
  },
  {
    name: 'Fart',
    displayName: 'A fart just occured'
  }
]);

myapp.register(function(status, err) {
  if (!status)
    throw err;
  else
    console.log('Fantastic! It just worked out of teh box.');
});

myapp.sendNotification('Fart', {
  title: 'Herro, my friend',
  callback: function(status, err) {
    if (!status)
      throw err;
    else
      console.log('Fantastic! The message was totally delivered.');
  }
});

myapp.sendNotification('Egg Shat', {
  text: 'Bacon egg',
  sticky: true,
  callback: function(status, err) {
    if (!status)
      throw err;
    else
      console.log('Fantastic! This message was totally delivered.');
  }
});
