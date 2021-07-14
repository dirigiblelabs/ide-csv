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

dsvView.controller('DsvViewController', ['$scope', '$window', function ($scope, $window) {
    let messageHub = new FramesMessageHub();
    let contents;
    let csrfToken;
    let manual = false;
    let isMac = false;
    let isFileChanged = false;
    $scope.rowMenuStyle = { 'display': 'none' };
    $scope.headerMenuStyle = { 'display': 'none' };
    let focusedCell = {};
    let focusedColumn = '';
    let headerEditMode = false;
    let csvData;
    $scope.dataLoaded = false;
    $scope.ctrlDown = false;
    $scope.ctrlKey = 17;
    const papaConfig = {
        delimiter: ",",
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
    };

    function checkPlatform() {
        let platform = window.navigator.platform;
        let macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K', 'darwin', 'Mac', 'mac', 'macOS'];

        if (macosPlatforms.indexOf(platform) !== -1) isMac = true;
    }

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
        $scope.file = searchParams.get('file');
        contents = loadContents($scope.file);
        csvData = Papa.parse(contents, papaConfig);
        fillGrid();
    }

    function fileChanged() {
        isFileChanged = true;
        messageHub.post({ data: $scope.file }, 'editor.file.dirty');
    }

    function fillGrid() {
        let columnDefs = csvData.meta.fields.map(
            (name, index) => (
                {
                    headerName: name,
                    field: name,
                    headerComponentParams: {
                        template:
                            `<div cid="cid_${index}" class="ag-cell-label-container" role="presentation">` +
                            '  <span ref="eMenu" class="ag-header-icon ag-header-cell-menu-button"></span>' +
                            `  <div cid="cid_${index}" ref="eLabel" class="ag-header-cell-label" role="presentation">` +
                            `    <input id="cid_${index}" class="header-input" type="text">` +
                            `    <span cid="cid_${index}" id="tid_${index}" ref="eText" class="ag-header-cell-text" role="columnheader"></span>` +
                            '    <span ref="eSortOrder" class="ag-header-icon ag-sort-order" ></span>' +
                            '    <span ref="eSortAsc" class="ag-header-icon ag-sort-ascending-icon" ></span>' +
                            '    <span ref="eSortDesc" class="ag-header-icon ag-sort-descending-icon" ></span>' +
                            '    <span ref="eSortNone" class="ag-header-icon ag-sort-none-icon" ></span>' +
                            '    <span ref="eFilter" class="ag-header-icon ag-filter-icon"></span>' +
                            '  </div>' +
                            '</div>'
                    }
                }
            )
        );
        columnDefs[0].rowDrag = true; // Adding drag handle to first column only
        columnDefs[0].headerCheckboxSelection = true; // Adding checkbox to first column only
        $scope.gridOptions = {
            defaultColDef: {
                sortable: true,
                filter: true,
                resizable: true,
                editable: true,
                flex: 1
            },
            rowDragManaged: true,
            suppressMoveWhenRowDragging: true,
            enableMultiRowDragging: true,
            animateRows: false,
            columnDefs: columnDefs,
            rowData: csvData.data,
            rowSelection: 'multiple',
            onColumnResized: function (params) {
                if (params.finished && manual) {
                    manual = false;
                }
            },
            onGridReady: function (event) {
                sizeToFit();
                $scope.dataLoaded = true;
            },
            onCellValueChanged: function (event) {
                fileChanged();
            },
            onColumnMoved: function (event) {
                fileChanged();
            },
            onRowDragEnd: function (event) {
                fileChanged();
            }
        };
    }

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
            isFileChanged = false;
            messageHub.post({ data: $scope.file }, 'editor.file.saved');
            messageHub.post({ data: 'File [' + $scope.file + '] saved.' }, 'status.message');
        } else {
            console.error('file parameter is not present in the request');
        }
    }

    function hideContextMenus() {
        if ($scope.rowMenuStyle.display !== "none") {
            $scope.rowMenuStyle = {
                display: "none"
            };
        }
        if ($scope.headerMenuStyle.display !== "none") {
            $scope.headerMenuStyle = {
                display: "none"
            };
        }
    }

    function showColumnContextMenu(x, y) {
        $scope.headerMenuStyle = {
            position: "fixed",
            display: "block",
            left: x + 'px',
            top: y + 'px'
        };
        $scope.rowMenuStyle = {
            display: "none"
        };
    }

    function showRowContextMenu(x, y) {
        $scope.rowMenuStyle = {
            position: "fixed",
            display: "block",
            left: x + 'px',
            top: y + 'px'
        };
        $scope.headerMenuStyle = {
            display: "none"
        };
    }

    $scope.handleClick = function (event) {
        if (event.which === 3) {
            if (
                event.originalTarget.className.includes("ag-header-cell-label") ||
                event.originalTarget.className.includes("ag-header-cell-text") ||
                event.originalTarget.className.includes("ag-cell-label-container")
            ) {
                focusedColumn = event.originalTarget.attributes.cid.value;
                showColumnContextMenu(event.clientX, event.clientY);
            } else if (event.originalTarget.className.includes("ag-cell")) {
                focusedCell = $scope.gridOptions.api.getFocusedCell();
                showRowContextMenu(event.clientX, event.clientY);
            } else if (
                !event.originalTarget.className.includes("dropdown-item") &&
                !event.originalTarget.className.includes("header-input")
            ) {
                hideContextMenus();
                hideColumnInput();
            }
        } else {
            try {
                if (
                    !event.originalTarget.className.includes("dropdown-item") &&
                    !event.originalTarget.className.includes("header-input")
                ) {
                    hideContextMenus();
                    hideColumnInput();
                }
            } catch (error) {
                if (error.toString() != 'Error: Permission denied to access property "className"') { // Firefox bug
                    console.log(error);
                }
            }
        }
        // let cell = $scope.gridOptions.api.getFocusedCell();
        // let rows = $scope.gridOptions.api.getSelectedRows();
    }

    $scope.keyDownFunc = function ($event) {
        if ($scope.ctrlDown && String.fromCharCode($event.which).toLowerCase() == 's') {
            $event.preventDefault();
            if (isFileChanged)
                $scope.save();
        }
    };

    angular.element($window).bind("keyup", function ($event) {
        if (isMac && "metaKey" in $event && $event.metaKey)
            $scope.ctrlDown = false;
        else if ($event.keyCode == $scope.ctrlKey)
            $scope.ctrlDown = false;
        $scope.$apply();
    });

    angular.element($window).bind("keydown", function ($event) {
        if (isMac && "metaKey" in $event && $event.metaKey)
            $scope.ctrlDown = true;
        else if ($event.keyCode == $scope.ctrlKey)
            $scope.ctrlDown = true;
        $scope.$apply();
    });

    $scope.downloadCsv = function () {
        $scope.gridOptions.api.exportDataAsCsv();
    };

    $scope.save = function () {
        contents = $scope.gridOptions.api.getDataAsCsv();
        saveContents(contents);
    };

    $scope.filterCsv = function () {
        $scope.gridOptions.api.setQuickFilter($scope.filterInput);
    };

    $scope.addRowAbove = function () {
        let row = {};
        Object.keys(csvData.data[0]).forEach(key => {
            row[key] = "";
        });
        csvData.data.splice(focusedCell.rowIndex, 0, row);
        $scope.gridOptions.api.setRowData(csvData.data);
        hideContextMenus();
        fileChanged();
    };

    $scope.addRowBelow = function () {
        let row = {};
        Object.keys(csvData.data[0]).forEach(key => {
            row[key] = "";
        });
        csvData.data.splice(focusedCell.rowIndex + 1, 0, row);
        $scope.gridOptions.api.setRowData(csvData.data);
        hideContextMenus();
        fileChanged();
    };

    $scope.deleteRow = function () {
        csvData.data.splice(focusedCell.rowIndex, 1);
        $scope.gridOptions.api.setRowData(csvData.data);
        hideContextMenus();
        fileChanged();
    };

    $scope.addColumn = function () {
        console.log("edit header");
        hideContextMenus();
    };

    $scope.editColumn = function () {
        hideContextMenus();
        headerEditMode = true;
        let columnDefs = $scope.gridOptions.api.getColumnDefs();
        let index = focusedColumn.replace("cid_", "");
        columnDefs[index].sortable = false;
        columnDefs[index].filter = false;
        $scope.gridOptions.api.setColumnDefs(columnDefs);
        showColumnInput();
    };

    function showColumnInput() {
        let columnInput = $(`#${focusedColumn}`);
        let columnText = $(`#${focusedColumn.replace("cid", "tid")}`);
        columnInput.val(columnText.text());
        columnInput.css({
            'display': 'inline-block'
        });
        columnText.css({
            'display': 'none'
        });
        columnInput.on('keypress', function (e) {
            if (e.which == 13) {
                hideColumnInput();
            }
        });
    }

    function hideColumnInput() {
        if (headerEditMode) {
            let columnInput = $(`#${focusedColumn}`);
            let newTitle = columnInput.val();
            let columnText = $(`#${focusedColumn.replace("cid", "tid")}`);
            columnInput.css({
                'display': 'none'
            });
            columnText.css({
                'display': 'inline-block'
            });
            columnInput.off();
            if (newTitle != columnText.text()) {
                let columnDefs = $scope.gridOptions.api.getColumnDefs();
                let index = focusedColumn.replace("cid_", "");
                columnDefs[index].sortable = true;
                columnDefs[index].filter = true;
                columnDefs[index].headerName = newTitle;
                $scope.gridOptions.api.setColumnDefs(columnDefs);
                fileChanged();
            }
            headerEditMode = false;
        }
    };

    $scope.deleteColumn = function () {
        hideContextMenus();
        console.log("edit header");
    };

    checkPlatform();
    load();

}]);