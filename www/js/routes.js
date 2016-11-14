angular.module('app.routes', [])

.config(function($stateProvider, $urlRouterProvider, $ionicConfigProvider) {

$ionicConfigProvider.views.maxCache(0);

$stateProvider

.state('login', {
    url: '/login',
    templateUrl: 'templates/login.html',
	controller: 'LoginCtrl'
})

.state('tab', {
    url: '/tab',
    abstract: true,
    templateUrl: 'templates/tabs.html',
	controller: 'TabsCtrl'
})

.state('tab.dashboard', {
    url: '/dashboard',
    views: {
        'tab-dashboard': {
            templateUrl: 'templates/dashboard.html',
            controller: 'DashboardCtrl'
        }
    }
})

.state('tab.activities', {
    url: '/activities',
    views: {
        'tab-activities': {
            templateUrl: 'templates/activities.html',
            controller: 'ActivitiesCtrl'
        }
    }
})

$urlRouterProvider.otherwise('/login')

});
