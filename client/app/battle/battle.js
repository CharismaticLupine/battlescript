angular.module('battlescript.battle', [])

.controller('BattleController', function($rootScope, $scope, $timeout, $location, $stateParams, Users, Battle, Editor) {

  ////////////////////////////////////////////////////////////
  // fetch auth user and pass in info to directive
  ////////////////////////////////////////////////////////////

  $scope.user = Users.getAuthUser();
  $scope.userInfo = {username: $scope.user};





  ////////////////////////////////////////////////////////////
  // set up spinner class and display it by default
  ////////////////////////////////////////////////////////////

  $scope.spinnerOn = true;





  ////////////////////////////////////////////////////////////
  // check first to see if valid battle room id
  ////////////////////////////////////////////////////////////

  $scope.battleRoomId = $stateParams.id;
  $scope.battleInitialized = false;

  Battle.isValidBattleRoom($scope.battleRoomId)
  .then(function(valid) {
    if (valid) {
      // if we have a valid battle room, then do this
      $rootScope.initBattleSocket($scope.battleRoomId, function() {
        // initialize battle socket events
        $scope.initBattle();
      });
    } else {
      // redirect to dashboard if battle id not valid
      $location.path('/dashboard');
    }
  })
  .catch(function(err) {
    console.log(err);
  });





  ////////////////////////////////////////////////////////////
  // set up user and opponent defaults
  ////////////////////////////////////////////////////////////

  // set up user states
  $scope.userReadyState = false;
  $scope.userReadyClass = '';
  $scope.userReadyText = 'Waiting on you';

  // set up opponent states
  $scope.opponentReadyState = false;
  $scope.opponentReadyClass = '';
  $scope.opponentReadyText = 'Waiting on opponent';

  $scope.userFinishReadingState = false;
  $scope.opponentFinishReadingState = false;





  ////////////////////////////////////////////////////////////
  // initialize the battle
  //
  // this, importantly, needs to be set up here after the
  // battle socket itself has been initialized and set up
  // above.
  //
  // unlike the updateUserReadyState function, this works
  // in tandem with the sockets. Hence, it needs to wait for
  // the socket to be initialized in the first place.
  ////////////////////////////////////////////////////////////

  $scope.initBattle = function() {
    // calls the function immediately, in case of refresh
    $scope.ifBothPlayersReady();

    // now listen for events
    // Checks if all users are on battle page
    $rootScope.battleSocket.on('listOfUsers', function(users) {
      if(users.length == 2) {
        console.log("Ready");
      } else {
        console.log("Not Ready");
      }
      $scope.numUsers = users.length == 2;
      console.log($scope.numUsers);
      if (!$scope.$$phase) $scope.$apply();

    });
    $rootScope.battleSocket.on('readyChange', function(ready) {
      $scope.opponentReadyState = ready;
      console.log($scope.opponentReadyState);
      $scope.opponentReadyText = $scope.opponentReadyState ? 'Ready for battle!' : 'Waiting on opponent';
      $scope.ifBothPlayersReady();
    });

    $rootScope.battleSocket.on('finishReadingChange', function(ready) {
      $scope.opponentFinishReadingState = ready;
      console.log($scope.opponentFinishReadingState);
      $scope.opponentFinishReadingText = $scope.opponentFinishReadingState ? 'Ready for battle!' : 'Waiting on opponent';
      if (!$scope.$$phase) $scope.$apply();
    });

    $rootScope.battleSocket.on('opponentReady', function(opponent) {
      $scope.opponent = opponent;
    });

    $rootScope.battleSocket.on('nameReq', function(){
      $rootScope.battleSocket.emit('nameSend', $scope.user);
    });
  };





  ////////////////////////////////////////////////////////////
  // this updates the user's ready state depending on whether
  // they clicks the button
  ////////////////////////////////////////////////////////////

  $scope.updateUserReadyState = function() {
    $scope.userReadyState  = !$scope.userReadyState;
    $scope.userReadyText = $scope.userReadyState ? 'Ready for battle!' : 'Waiting on you';
    $rootScope.battleSocket.emit('readyChange', $scope.userReadyState);

    $scope.ifBothPlayersReady();
  };


  ////////////////////////////////////////////////////////////
  // this updates the user's ready state depending on whether
  // they clicks the button
  ////////////////////////////////////////////////////////////

  $scope.updateUserFinishReadingState = function() {
    $scope.userFinishReadingState  = !$scope.userFinishReadingState;
    $scope.userFinishReadingStateText = $scope.userFinishReadingState ? 'Ready for battle!' : 'Waiting on you';
    $rootScope.battleSocket.emit('finishReadingChange', $scope.userFinishReadingState);
  };




  ////////////////////////////////////////////////////////////
  // checks if both players ready
  //
  // this gets called each time a user clicks a "ready state"
  // button.
  ////////////////////////////////////////////////////////////

  $scope.ifBothPlayersReady = function() {
    if ($scope.userReadyState && $scope.opponentReadyState || window.localStorage.getItem('battleInitiated-' + $scope.battleRoomId)) {
      $scope.inBattle = true;
      // If battle has already been initiated, set user and opponent ready state to true
      // so that waiting screen will not show
      if (window.localStorage.getItem('battleInitiated-' + $scope.battleRoomId)){
        $scope.userReadyState = true;
        $scope.opponentReadyState = true;
        $scope.userFinishReadingState = true;
        $scope.opponentFinishReadingState = true;
        if (!$scope.$$phase) $scope.$apply();

        $rootScope.battleSocket.emit('getOpponent');
      } else {
        // Save battle initiated to local storage: this will allow battle to reload automatically
        // if user refreshes page, or comes back to battle after leaving accidentally
        window.localStorage.setItem('battleInitiated-' + $scope.battleRoomId, true);
      }

      $scope.setUpBattle();
    } else {
      // show the battle waiting area
      $scope.spinnerOn = false;
      $scope.showBattleWaitingArea = true;
      if (!$scope.$$phase) $scope.$apply();
    }
  };





  ////////////////////////////////////////////////////////////
  // set up the battle here
  ////////////////////////////////////////////////////////////

  $scope.setUpBattle = function() {
    $scope.spinnerOn = true;
    if (!$scope.$$phase) $scope.$apply();

    // set up user editors
    $scope.userEditor = Editor.makeEditor('#editor--user', false);
    // set up user test editor
    $scope.testEditor = Editor.makeEditor('#editor--test', false);
    // set up opponent editor
    $scope.opponentEditor = Editor.makeEditor('#editor--opponent', true);
    $scope.handleEditorEvents();

    // set up various fields
    $scope.userButtonAttempt = 'Attempt Solution';
    $scope.userButtonTest = 'Run Tests';
    $scope.userNotes = 'Nothing to show yet...';

    // get the battle
    $scope.getBattle();
  };





  ////////////////////////////////////////////////////////////
  // handle editor events
  ////////////////////////////////////////////////////////////

  $scope.handleEditorEvents = function() {
    $scope.userEditor.on('change', function(e) {
      $rootScope.battleSocket.emit('userTextChange', $scope.userEditor.getValue());
    });

    $rootScope.battleSocket.on('updateOpponent', function(text){
      $scope.opponentEditor.setValue(text);
    });
  };





  ////////////////////////////////////////////////////////////
  // get the battle, get ready for showdown!
  ////////////////////////////////////////////////////////////

  $scope.getBattle = function() {
    // first, cache some vars
    $scope.battle;
    $scope.battleDescription = null;
    $scope.battleProjectId = null;
    $scope.battleSolutionId = null;

    // fetch a battle
    Battle.getBattle($scope.battleRoomId)
    .then(function(data) {
      // display the battle field
      $scope.displayBattleField();

      // set up the battle specifics
      $scope.battle = JSON.parse(data.body);
      $scope.battleDescription = marked($scope.battle.description);
      $scope.battleProjectId = $scope.battle.session.projectId;
      $scope.battleSolutionId = $scope.battle.session.solutionId;

      // update editors
      $timeout(function() {
        $scope.userEditor.setValue($scope.battle.session.setup);
        $scope.opponentEditor.setValue($scope.battle.session.setup);
        $scope.testEditor.setValue($scope.battle.session.exampleFixture);
        $scope.$apply();
      }, 50);

    })
    .catch(function(err) {
      console.log('There was an error fetching the problem...');
      console.log(err);
    });
  };





  ////////////////////////////////////////////////////////////
  // display the battle field
  ////////////////////////////////////////////////////////////

  $scope.displayBattleField = function() {
    // hide the spinner, hide the waiting area, and show the battle field
    $scope.spinnerOn = false;
    $scope.showBattleWaitingArea = false;
    $scope.battleFieldClass = 'active';

    // handle battle field events
    $scope.handleBattleFieldEvents();
  };





  ////////////////////////////////////////////////////////////
  // handle battle events
  ////////////////////////////////////////////////////////////

  $scope.handleBattleFieldEvents = function() {
    $rootScope.battleSocket.on('opponentWon', function(){
      // Any negative is regarded as a loss.
      Users.statChange($scope.user, -1);

      // alert to the user!
      alert('Looks like your opponent got the answer first!');

      //redirect back. winner found
      $location.path('/dashboard');
    });
  };








  ////////////////////////////////////////////////////////////
  // handle battle attempts
  ////////////////////////////////////////////////////////////

  $scope.attemptBattle = function($event) {
    $event.preventDefault();

    $scope.userButtonAttempt = 'Attempting...';

    Battle.attemptBattle($scope.battleProjectId, $scope.battleSolutionId, $scope.userEditor.getValue())
      .then(function(data) {
        $scope.userButtonAttempt = 'Attempt Solution';
        $scope.userNotesBattle = data.reason;

        // TODO: polling is successful at this point in time, time to send
        // and recieve the correct data
        console.log(data);
        if (data['passed'] === true) {
          Users.statChange($scope.user, 1); // # of times to increase the wins. Should be 1 always
          $rootScope.battleSocket.emit('winnerFound');
          $scope.userNotesBattle = "All tests passing!";
          alert('You have the answer. Good job!');
          $location.path('/dashboard'); //redirect back. winner found
        }
      });
  };

  ////////////////////////////////////////////////////////////
  // handle test attempts
  ////////////////////////////////////////////////////////////


  $scope.runTests = function($event) {
    $event.preventDefault();

    $scope.userButtonTest = 'Testing...';

    Battle.runTests($scope.userEditor.getValue(), $scope.testEditor.getValue())
      .then(function(data) {
        $scope.userButtonTest = 'Run Tests';
        console.log(data.testResults.join('\n'));
        $scope.userNotesTest = data.testResults.join('\n');
        $scope.userNotesConsole = data.codelog;
        
        
      });
  };

});
