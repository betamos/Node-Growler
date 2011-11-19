
var gtnp = require('./gtnp');

var myapp = new gtnp.GrowlApplication('Shit Head', {
//  host: '192.168.0.11',
  debug: true,
  applicationIcon: './volcano.jpg'
});

myapp.debug = true;

myapp.addNotifications([
  {
    name: 'Egg Shat',
    displayName: 'Egg was shat'
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

myapp.sendNotification('Fart', 'Herro, my friend', null, function(status, err) {
  if (!status)
    throw err;
  else
    console.log('Fantastic! The message was totally delivered.');
});

myapp.sendNotification('Egg Shat', 'Egg got shat', 'this time, egg really got shat badly', function(status, err) {
  if (!status)
    throw err;
  else
    console.log('Fantastic! The message was totally delivered.');
}, true);
