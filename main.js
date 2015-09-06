"use strict";

var widgetsApp = angular.module('widgetsDirectory', ['pascalprecht.translate'], ['$translateProvider', function ($translateProvider) {
    $translateProvider.useStaticFilesLoader({
        prefix: 'i18n/locale-',
        suffix: '.json'
    });
    $translateProvider.preferredLanguage('en');
}]);

widgetsApp.controller('MainCtrl',['$scope','$http', '$translate',
    function ($scope, $http, $translate) {
        $scope.organizadores = 'https://spreadsheets.google.com/feeds/list/13DPK0RYJTqj_vSJj9y_UKEemX04Z59vB-QEddIAc5CE/1/public/values?alt=json-in-script&callback=JSON_CALLBACK';

        $http.get('i18n/locale-en.json').
            then(function(response) {
                var widgets = [];
                response.data.widgets.forEach(function(elem){
                    if(elem.published){ widgets.push(elem); }
                });
                $scope.widgets = widgets;
            });

        $scope.preview = function(i){
            $scope.w = $scope.widgets[i];
            console.log($scope.w);
            $("#widgetModal").modal()
        };

        $scope.filterFunction = function(element) {
            if($scope.query && typeof $scope.query.toLowerCase === "function"){
                var name = element.name.toLowerCase(),
                    desc = element.description.toLowerCase(),
                    w = $scope.query.toLowerCase();

                return (name.indexOf(w) !== -1 || desc.indexOf(w) !== -1) ? true : false;
            }else{
                return !$scope.query;
            }
        };

        $scope.changeLanguage = function(lang) {
            $translate.use(lang);

            $http.get('i18n/locale-'+lang+'.json').
                then(function(response) {
                    var widgets = [];
                    response.data.widgets.forEach(function(elem){
                        if(elem.published){ widgets.push(elem); }
                    });
                    $scope.widgets = widgets;
                });
        };
    }
]);

widgetsApp.filter('trusted', ['$sce', function ($sce) {
    return function(url) {
        return $sce.trustAsResourceUrl(url);
    };
}]);