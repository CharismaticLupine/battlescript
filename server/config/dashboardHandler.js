// requirements
var BattleController = require('../battles/battleController');

var User = require('../users/userModel.js');
var Q    = require('q');

var socketList = {};

var tournamentPool = {};

module.exports = function(socket, io){
  socket.join('dashboard');

  var username = socket.handshake.query.username;
  socketList[username] = socket.id;
  
  // send signal that user has connected to dashboard
  var updateUsers = function(){
    socket.in('dashboard').emit('updateUsers', socketList);
    socket.emit('updateUsers', socketList);
  }

  // Update Users when first connected
  
  updateUsers();
  
  // look for signal that someone wants to battle
  socket.on('outgoingBattleRequest', function(userData){
    var oppId = socketList[userData.toUser];

    socket.broadcast.to(oppId).emit('incomingBattleRequest', {
      fromUser: userData.fromUser,
      challengeLevel: userData.challengeLevel
    });
  });

  // look for signal that a battle has been accepted
  socket.on('battleAccepted', function(userData) {
    var userId = socketList[userData.user];
    var opponentId = socketList[userData.opponent];
    var challengeLevel = userData.challengeLevel;
    console.log("BATTLE ACCEPTED, CHALLENGE LEVEL: ", challengeLevel);

    BattleController.addBattleRoom(challengeLevel, function(roomhash) {
      // now, need to broadcast to the opponent that it's time for battle
      socket.broadcast.to(opponentId).emit('prepareForBattle', {roomhash: roomhash});

      // and also, broadcast back to user
      io.sockets.connected[userId].emit('prepareForBattle', {roomhash: roomhash});
    });
  });


  /////////////////////////////////////////////////////////
  //////       tournement matching    /////////////////////
  /////////////////////////////////////////////////////////

  socket.on('joinTournament', function(userData){
    var userId = socketList[userData.user];
    tournamentPool[username] = socket.id;

    console.log(tournamentPool)
    io.sockets.connected[userId].emit('message', tournamentPool);

  });

  socket.on('leaveTournament', function(userData){
    var userId = socketList[userData.user];
    delete tournamentPool[username];

    io.sockets.connected[userId].emit('message', tournamentPool);
  });


  ////////////////////////////////////////////////////////
  //             disconnect                             //
  ////////////////////////////////////////////////////////

  socket.on('disconnect', function(){
    console.log('SERVER DISCONNECTing DASHBOARD SOCKET');
    delete socketList[username];
    delete tournamentPool[username];

    setTimeout(function() {
      updateUsers();
    }, 200);
  });
};
