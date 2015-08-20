// requirements
var BattleController = require('../battles/battleController');

var User = require('../users/userModel.js');
var Q    = require('q');

var socketList = {};

var tournamentPool = [];

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

  var getUser = function(username){
    return Q.nbind(User.findOne, User)({username: username});
  };

  var matchCompetitors = function(){
    var maxDifference = 5;
    if (tournamentPool.length <= 1){
      // if not enough competitors, return and wait for new users to join
      return false;
    }
    // try to find the most even match
    var newTournamentPool = tournamentPool.sort(function(a, b){
      return b.totalWins - a.totalWins; // sort highest to lowest
    }).filter(function(contender, idx, tournamentPool){
      var nextContender = tournamentPool[idx + 1];

      // if contender is already matched, don't add to newTournamentPool
      if(contender.matched){ return false; }
      // if next contender doesn't exist, don't compare
      if(!nextContender){ return contender.matched; }
      // compare each contender to the next contender
      if(contender.totalWins - nextContender.totalWins <= maxDifference){
        // TODO: challenge level should not be hard coded
        BattleController.addBattleRoom(8, function(roomhash) {
          var contender1 = socketList[nextContender.username],
              contender2 = socketList[contender.username];

          // broadcast to each contender to prepareForBattle
          console.log('Match between: ', contender.username, ' and ', nextContender.username, ': ', contender.totalWins - nextContender.totalWins);
          socket.broadcast.to(contender1).emit('prepareForBattle', {roomhash: roomhash});
          socket.broadcast.to(contender2).emit('prepareForBattle', {roomhash: roomhash});
        });
        // if matched, don't add to newTournamentPool
        nextContender.matched = true;
        return false;
      }

      // if not matched, add to newTournamentPool
      return true;
    });

    // replace tournamentPool w/ newTournamentPool (which is missing all matched contenders)
    tournamentPool = newTournamentPool;
  };

  // poll matchCompetitors
  setInterval(matchCompetitors, 5000);

  socket.on('joinTournament', function(userData){
    var userId = socketList[userData.user];

    // store username in tournamentPool with user stats
    getUser(username).then(function(user){
      tournamentPool.push({
        totalWins: user.totalWins,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        username: username,
        matched: false
      });

      io.sockets.connected[userId].emit('message', tournamentPool);
    });


  });

  socket.on('leaveTournament', function(userData){
    var userId = socketList[userData.user];
    // initialize a new tournamentPool array without username
    tournamentPool = tournamentPool.filter(function(user){
      return user.username !== username;
    })

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
