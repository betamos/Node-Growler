

var gtnp = require('./gtnp');

var conf = {
  host: 'localhost',
  port: 23053
};

var myapp = new gtnp.GrowlApplication('ShitHead');

myapp.register(function(status, err) {
  if (!status)
    throw err;
  else
    console.log('Fantastic! It just worked out of teh box.');
});
