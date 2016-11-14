angular.module('app.controllers', [])

.controller('DashboardCtrl', function($scope, $ionicModal, $firebaseObject, $firebaseAuth, $firebaseArray) {

    // Pull data

	$scope.auth = $firebaseAuth().$getAuth();
	$scope.profiles = $firebaseObject(firebase.database().ref("users"));
	$scope.scores = $firebaseObject(firebase.database().ref("users-data/" + $scope.auth.uid + "/scores"));
	$scope.leaderboard = $firebaseArray(firebase.database().ref("leaderboards/Total Points").orderByValue());

	// Get rank

	$scope.leaderboard.$watch(function() {
		var i = 0;
		for(user of $scope.leaderboard) {
			if(user.$id == $scope.auth.uid) {
				$scope.rank = $scope.leaderboard.length - i;
				break;
			}
			i++;
		}
	});

	// Modal logic

	$ionicModal.fromTemplateUrl('templates/leaderboard.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function(modal) {
        $scope.modal = modal;
    });
    $scope.$on('$destroy', function() {
        $scope.modal.remove();
    });
	$scope.showModal = function(leaderboard) {
		$scope.modal.show();
		if(leaderboard == 'Total Points') {
			$scope.modal.leaderboard = $scope.leaderboard;
		} else {
			$scope.modal.leaderboard = $firebaseArray(firebase.database().ref("leaderboards/" + leaderboard).orderByValue());
		};
		$scope.modal.title = leaderboard;
	};
	$scope.hideModal = function() {
		$scope.modal.hide();
		delete $scope.modal.leaderboard;
		delete $scope.modal.title;
	};

})

.controller('ActivitiesCtrl', function($q, $timeout, $scope, $ionicModal, $ionicPopup, $ionicPlatform, $firebaseArray, $firebaseAuth, $firebaseObject, $cordovaCamera, $cordovaFile) {

    // Pull data

	$scope.auth = $firebaseAuth().$getAuth();
	$scope.activities = $firebaseArray(firebase.database().ref("activities"));
	$scope.userData = $firebaseObject(firebase.database().ref("users-data/" + $scope.auth.uid));
	$scope.globalLeaderboard = $firebaseObject(firebase.database().ref("leaderboards/Total Points/" + $scope.auth.uid));

	// Validate special fields

	$scope.validateSpecial = function() {
		var validation = true;
		for(question in $scope.modal.activity.questions) {
			if(!$scope.modal.activity.questions[question].optional) {
				if($scope.modal.answers == null || $scope.modal.answers[question] == null)
					validation = false;
				else if($scope.modal.activity.questions[question].type == "input" && $scope.modal.answers[question] == "")
					validation = false;
			};
		};
		return validation;
	};

	// Take photo

	$scope.getImage = function(key) {

		var options = {
			destinationType: Camera.DestinationType.FILE_URI,
			sourceType: Camera.PictureSourceType.CAMERA,
			encodingType: Camera.EncodingType.JPEG
		};

		$ionicPlatform.ready(function() {

			$cordovaCamera.getPicture(options).then(function(uri) {

				$scope.modal.progress = "Starting upload...";
				var fileName = $scope.auth.uid + "-" + (new Date).getTime() + ".jpg";
				var folder = uri.substring(0, uri.lastIndexOf('/') + 1);
				var file = uri.substring(uri.lastIndexOf('/') + 1, uri.length);
				$cordovaFile.readAsArrayBuffer(folder, file).then(function(success) {
					var blob = new Blob([success], {type: 'image/jpeg'});
					var uploadTask = firebase.storage().ref("activities-data/" + $scope.modal.activity.$id + "/" + fileName).put(blob);
					uploadTask.on('state_changed', function(snapshot) {
						$scope.modal.progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) + "% complete...";
						$scope.$digest();
					}, error, function () {
						$scope.modal.progress = "Upload complete.";
						if($scope.modal.answers == null)
							$scope.modal.answers = {};
						$scope.modal.answers[key] = uploadTask.snapshot.downloadURL;
						$scope.$digest();
					});
				}, error);

				function error() {
					delete $scope.modal.progress;
					$ionicPopup.alert({
						title: 'Error',
						template: 'The upload failed.'
					});
				};

			});

		});

	};

	// Send data back

	$scope.completeActivity = function() {

		if($scope.modal.stars == null) {

			$ionicPopup.alert({
				title: 'Error',
				template: 'Please rate the activity.'
			});

		} else if($scope.modal.activity.questions != null && !$scope.validateSpecial()) {

			$ionicPopup.alert({
				title: 'Error',
				template: 'Please provide all required input.'
			});

		} else {

			var timestamp = (new Date).getTime();
			var updates = {};

			updates["users-data/" + $scope.auth.uid + "/scores/" + $scope.modal.activity.type] = $scope.userData.scores[$scope.modal.activity.type] + $scope.modal.activity.points;
			updates["users-data/" + $scope.auth.uid + "/scores/Total Points"] = $scope.userData.scores['Total Points'] + $scope.modal.activity.points;
			updates["users-data/" + $scope.auth.uid + "/ratings/" + $scope.modal.stars] = $scope.userData.ratings[$scope.modal.stars] + 1;
			updates["users-data/" + $scope.auth.uid + "/history/" + timestamp] = $scope.modal.activity.$id;

			// Data to activities-data

			$scope.activityData = $firebaseObject(firebase.database().ref("activities-data/" + $scope.modal.activity.$id));
			$scope.activityDataPromise = $scope.activityData.$loaded(function(activityData) {
				updates["activities-data/" + $scope.modal.activity.$id + "/ratings/" + $scope.modal.stars] = activityData.ratings[$scope.modal.stars] + 1;
				if($scope.modal.answers != null) {
					updates["activities-data/" + $scope.modal.activity.$id + "/history/" + timestamp] = {
						user: $scope.auth.uid,
						answers: $scope.modal.answers
					};
				} else {
					updates["activities-data/" + $scope.modal.activity.$id + "/history/" + timestamp] = $scope.auth.uid;
				};
			});

			// Data to leaderboards

			$scope.localLeaderboard = $firebaseObject(firebase.database().ref("leaderboards/" + $scope.modal.activity.type + "/" + $scope.auth.uid));
			$scope.localLeaderboardPromise = $scope.localLeaderboard.$loaded(function(localLeaderboard) {
				updates["leaderboards/" + $scope.modal.activity.type + "/" + $scope.auth.uid] = localLeaderboard.$value + $scope.modal.activity.points;
			});

			updates["leaderboards/Total Points/" + $scope.auth.uid] = $scope.globalLeaderboard.$value + $scope.modal.activity.points;

			// Point stealing

			if($scope.modal.activity.type == "Stolen by Me") {

				$scope.victimScores = $firebaseObject(firebase.database().ref("users-data/" + $scope.modal.answers["_victim"] + "/scores"));
				$scope.victimScoresPromise = $scope.victimScores.$loaded(function(victimScores) {
					updates["users-data/" + $scope.modal.answers["_victim"] + "/scores/Stolen from Me"] = victimScores["Stolen from Me"] + $scope.modal.activity.points;
					updates["users-data/" + $scope.modal.answers["_victim"] + "/scores/Total Points"] = victimScores["Total Points"] - $scope.modal.activity.points;
				});

				$scope.stolenFromLeaderboard = $firebaseObject(firebase.database().ref("leaderboards/Stolen from Me/" + $scope.modal.answers["_victim"]));
				$scope.stolenFromLeaderboardPromise = $scope.stolenFromLeaderboard.$loaded(function(stolenFromLeaderboard) {
					updates["leaderboards/Stolen from Me/" + $scope.modal.answers["_victim"]] = stolenFromLeaderboard.$value + $scope.modal.activity.points;
				});

				$scope.victimLeaderboard = $firebaseObject(firebase.database().ref("leaderboards/Total Points/" + $scope.modal.answers["_victim"]));
				$scope.victimLeaderboardPromise = $scope.victimLeaderboard.$loaded(function(victimLeaderboard) {
					updates["leaderboards/Total Points/" + $scope.modal.answers["_victim"]] = victimLeaderboard.$value - $scope.modal.activity.points;
				});

			};

			$scope.pullPromise = $q.all([
				$scope.activityDataPromise,
				$scope.localLeaderboardPromise,
				$scope.victimScoresPromise,
				$scope.stolenFromLeaderboardPromise,
				$scope.victimLeaderboardPromise
			]);

			var updateSuccess = false;

			$scope.pushPromise = $scope.pullPromise.then(function() {
				firebase.database().ref().update(updates).then(function() {
					updateSuccess = true;
					$ionicPopup.alert({
						title: 'Well done!',
						template: 'You\'ve received ' + $scope.modal.activity.points + ' points.'
					}).then(function() {
						$scope.hideModal();
					});
				});
			});

			$timeout(function() {
				if(!updateSuccess) {
					$scope.hideModal();
					$ionicPopup.alert({
						title: 'Error',
						template: 'Your connection is slow. Try using the Wi-Fi.'
					});
				};
				delete $scope.pullPromise;
				delete $scope.pushPromise;
				delete $scope.activityDataPromise;
				delete $scope.localLeaderboardPromise;
				delete $scope.victimScoresPromise;
				delete $scope.stolenFromLeaderboardPromise;
				delete $scope.victimLeaderboardPromise;
				delete $scope.activityData;
				delete $scope.localLeaderboard;
				delete $scope.victimScores;
				delete $scope.stolenFromLeaderboard;
				delete $scope.victimLeaderboard;
			}, 5000);

		};
	};

	// Modal logic

	$ionicModal.fromTemplateUrl('templates/activity-detail.html', {
        scope: $scope,
        animation: 'slide-in-up'
    }).then(function(modal) {
        $scope.modal = modal;
    });
    $scope.$on('$destroy', function() {
        $scope.modal.remove();
    });
	$scope.showModal = function(activity) {
		$scope.modal.show();
		$scope.modal.activity = activity;
	};
	$scope.hideModal = function() {
		$scope.modal.hide();
		delete $scope.modal.activity;
		delete $scope.modal.stars;
		delete $scope.modal.answers;
		delete $scope.modal.progress;
	};

})

.controller('LoginCtrl', function($scope, $firebaseAuth, $state, $ionicPopup) {

	$scope.user = {
		email: localStorage.getItem("email"),
		password: localStorage.getItem("password")
	};

	$scope.signIn = function(user) {
		$firebaseAuth().$signInWithEmailAndPassword(user.email, user.password).then(function(auth) {
			localStorage.setItem("email", user.email);
			localStorage.setItem("password", user.password);
			$state.go('tab.dashboard', null, {reload: true});
		}, function() {
			$ionicPopup.alert({
				title: 'Error',
				template: 'Please try again.'
			});
		});
	};

})

.controller('TabsCtrl', function($scope, $firebaseAuth, $state) {

	$scope.signOut = function() {
		$firebaseAuth().$signOut();
		$state.go('login', null, {reload: true});
	};

	$scope.android = ionic.Platform.isAndroid();

})
