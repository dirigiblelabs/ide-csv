/*
 * Copyright (c) 2010-2021 SAP SE or an SAP affiliate company and Eclipse Dirigible contributors
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-FileCopyrightText: 2010-2021 SAP SE or an SAP affiliate company and Eclipse Dirigible contributors
 * SPDX-License-Identifier: EPL-2.0
 */

agGrid.initialiseAgGridWithAngular1(angular);
let dsvView = angular.module('dsv-editor', ["agGrid"]);

dsvView.controller('DsvViewController', ['$scope', function ($scope) {
    let messageHub = new FramesMessageHub();
    let contents;
    let csrfToken;
    let manual = false;
    let csvRaw;
    const papaConfig = {
        delimiter: ",",
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
    };

    function sizeToFit() {
        manual = false;
        $scope.gridOptions.api.sizeColumnsToFit();
    }

    function getResource(resourcePath) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', resourcePath, false);
        xhr.setRequestHeader('X-CSRF-Token', 'Fetch');
        xhr.send();
        if (xhr.status === 200) {
            csrfToken = xhr.getResponseHeader("x-csrf-token");
            return xhr.responseText;
        }
    }

    function loadContents(file) {
        if (file) {
            return getResource('../../../../../../services/v4/ide/workspaces' + file);
        }
        console.error('file parameter is not present in the URL');
    }

    function load() {
        let searchParams = new URLSearchParams(window.location.search);
        let file = searchParams.get('file');
        contents = loadContents(file);
        csvRaw = contents;
        let csvData = Papa.parse(csvRaw, papaConfig);
        let columnDefs = csvData.meta.fields.map(name => ({ headerName: name, field: name }));
        $scope.gridOptions = {
            columnDefs: columnDefs,
            rowData: csvData.data,
            enableSorting: true,
            enableColResize: true,
            onColumnResized: function (params) {
                if (params.finished && manual) {
                    manual = false;
                }
            },
            onGridReady: function (event) {
                sizeToFit()
            },
        };
    }

    load();

    function saveContents(text) {
        console.log('Save called...');
        if ($scope.file) {
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', '../../../../../../services/v4/ide/workspaces' + $scope.file);
            xhr.setRequestHeader('X-Requested-With', 'Fetch');
            xhr.setRequestHeader('X-CSRF-Token', csrfToken);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    console.log('file saved: ' + $scope.file);
                }
            };
            xhr.send(text);
            messageHub.post({ data: $scope.file }, 'editor.file.saved');
            messageHub.post({ data: 'File [' + $scope.file + '] saved.' }, 'status.message');
        } else {
            console.error('file parameter is not present in the request');
        }
    }

    $scope.save = function () {
        contents = JSON.stringify($scope.extension);
        saveContents(contents);
    };

    $scope.$watch(function () {
        var extension = JSON.stringify($scope.extension);
        if (contents !== extension) {
            messageHub.post({ data: $scope.file }, 'editor.file.dirty');
        }
    });
}]);