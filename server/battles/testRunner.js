//taken from https://github.com/Codewars/codewars-runner/tree/master/examples/javascript/ and modified to suit our purposes
var __vm = require('vm');


// Wraps stdout so we can capture the console.logs of our virtual machines
function captureStdout(callback) {
    var output = '', old_write = process.stdout.write;

    // start capture
    process.stdout.write = function(str, encoding, fd) {
        output += str;
    };

    callback();

    // end capture
    process.stdout.write = old_write;

    return output;
}




module.exports = function(code, testCode){
  require('./testFramework.js');
  //using VM to isolate test and user code. 
  //need to attach output to the global object so the testframework can generate output
  global.output = [];
  var log = captureStdout(function(){
    try { 
      __vm.runInThisContext(code);
      __vm.runInThisContext(testCode);

      
    } catch (e){
      console.log(e);
    }
  });
  
  return {testResults: output, codelog: log};
};



