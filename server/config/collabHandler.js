var roomModel = require('../room/roomModel.js');
module.exports = function(socket, io) {
  var username = socket.handshake.query.username;
  var roomhash = socket.handshake.query.roomhash;
  var room = roomModel.createOrGetRoom(roomhash);
  room.maxOccupancy = 100;

  var addUserToRoom = function() {
    room.users.push(username);
    socket.join(room.id);
  };

  var removeUserFromRoom = function() {
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
      socket.broadcast.to(room.id).emit('listOfUsers', room.users); // broadcast to ALL OTHER users
    });

    socket.on('editorState', function(changeObj) {
      if (changeObj.origin == '+input' || changeObj.origin == 'paste' || changeObj.origin == '+delete') {
        socket.broadcast.to(room.id).emit('editorState', changeObj);
      }
    });
  }();
};
