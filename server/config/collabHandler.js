var roomModel = require('../room/roomModel.js');
module.exports = function(socket, io) {
  var username = socket.handshake.query.username;
  var roomhash = socket.handshake.query.roomhash;
  var room = roomModel.createOrGetRoom(roomhash);

  var addUserToRoom = function() {
    room.users.push(username);
    socket.join(room.id);
  };

  var removeUserFromRoom = function() {
    console.log(username, ' DISCONECTED FROM COLLAB ROOM: ', room.id);
    room.members--;
    room.users.splice(room.users.indexOf(username), 1);
    if (room.members === 0) {
      roomModel.removeRoom(room.id);
    }
  };

  var initRoom = function() {
    if (room === null) {
      console.error('Collab room is full');
    } else {
      addUserToRoom();
      io.sockets.in(room.id).emit('listOfUsers', room.users); // broadcast to ALL users in room
    }

    socket.on('disconnect', function(data) {
      removeUserFromRoom();
      io.sockets.in(room.id).emit('listOfUsers', room.users); // broadcast to ALL OTHER users
    });

  }();
};
