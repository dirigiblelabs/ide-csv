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
    $scope.menuStyle = { 'display': 'none' };
    $scope.menuContext = { // Used for context menu content visibility
        viewport: false,
        row: false,
        column: false
    };
    let focusedCell = {};
    let focusedColumnIndex = -1;
    let headerEditMode = false;
    let csvData;
    let ctrlDown = false;
    $scope.dataLoaded = false;
    const ctrlKey = 17;
    const papaConfig = {
        columnIndex: 0, // Custom property, needed for duplicated column names
        delimiter: ",",
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: function (headerName) {
            this.columnIndex++;
            return `${headerName}_${this.columnIndex}`;
        },
        complete: function () {
            this.columnIndex = 0;
        }
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
                    headerName: name.split(/\_(?=[^\_]+$)/)[0], // Get the name without the index
                    field: name,
                    headerComponentParams: {
                        template:
                            `<div cid="${index}" class="ag-cell-label-container" role="presentation">` +
                            '  <span ref="eMenu" class="ag-header-icon ag-header-cell-menu-button"></span>' +
                            `  <div cid="${index}" ref="eLabel" class="ag-header-cell-label" role="presentation">` +
                            `    <input id="iid_${index}" class="header-input" type="text">` +
                            `    <span cid="${index}" id="tid_${index}" ref="eText" class="ag-header-cell-text" role="columnheader"></span>` +
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
            let xhr = new XMLHttpRequest();
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

    function hideContextMenu() {
        if ($scope.menuStyle.display !== "none") {
            $scope.menuContext.viewport = false;
            $scope.menuContext.row = false;
            $scope.menuContext.column = false;
            $scope.menuStyle = {
                display: "none"
            };
        }
    }

    /**
     * Simulating named parameters using a params object
     * It can contain the following parameters:
     * {
     *  x: 10, // Required, X position
     *  y: 10, // Required, Y position
     *  viewport: true, // Optional, when the menu is for the empty viewport
     *  row: true, // Optional, when the menu is for a row
     *  column: true // Optional, when the menu is for a column header
     * }
     * The last 3 are optional but one must be specified or the menu will not be shown.
     */
    function showContextMenu(params) {
        if (
            "viewport" in params &&
            !("row" in params) &&
            !("column" in params)
        ) {
            $scope.menuContext.viewport = true;
            $scope.menuContext.row = false;
            $scope.menuContext.column = false;
        } else if (
            !("viewport" in params) &&
            "row" in params &&
            !("column" in params)
        ) {
            $scope.menuContext.viewport = false;
            $scope.menuContext.row = true;
            $scope.menuContext.column = false;
        } else if (
            !("viewport" in params) &&
            !("row" in params) &&
            "column" in params
        ) {
            $scope.menuContext.viewport = false;
            $scope.menuContext.row = false;
            $scope.menuContext.column = true;
        } else
            return
        if ("x" in params && "y" in params) {
            $scope.menuStyle = {
                position: "fixed",
                display: "block",
                left: params.x + 'px',
                top: params.y + 'px'
            };
        } else {
            hideContextMenu();
        }
    };

    $scope.handleClick = function (event) {
        if (event.which === 3) {
            if (
                event.originalTarget.className.includes("ag-header-cell-label") ||
                event.originalTarget.className.includes("ag-header-cell-text") ||
                event.originalTarget.className.includes("ag-cell-label-container")
            ) {
                focusedColumnIndex = parseInt(event.originalTarget.attributes.cid.value);
                showContextMenu({ x: event.clientX, y: event.clientY, column: true });
            } else if (event.originalTarget.className.includes("ag-cell")) {
                focusedCell = $scope.gridOptions.api.getFocusedCell();
                showContextMenu({ x: event.clientX, y: event.clientY, row: true });
            } else if (event.originalTarget.className.includes("ag-center-cols-viewport")) {
                showContextMenu({ x: event.clientX, y: event.clientY, viewport: true });
            } else if (
                !event.originalTarget.className.includes("dropdown-item") &&
                !event.originalTarget.className.includes("header-input")
            ) {
                hideContextMenu();
                hideColumnInput();
            }
        } else {
            try {
                if (
                    !event.originalTarget.className.includes("dropdown-item") &&
                    !event.originalTarget.className.includes("header-input")
                ) {
                    hideContextMenu();
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
        if (
            ctrlDown &&
            String.fromCharCode($event.which).toLowerCase() == 's'
        ) {
            $event.preventDefault();
            if (isFileChanged)
                $scope.save();
        }
    };

    angular.element($window).bind("keyup", function ($event) {
        ctrlDown = false;
    });

    angular.element($window).bind("keydown", function ($event) {
        if (isMac && "metaKey" in $event && $event.metaKey)
            ctrlDown = true;
        else if ($event.keyCode == ctrlKey)
            ctrlDown = true;
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
        hideContextMenu();
        let row = {};
        Object.keys(csvData.data[0]).forEach(key => {
            row[key] = "";
        });
        csvData.data.splice(focusedCell.rowIndex, 0, row);
        $scope.gridOptions.api.setRowData(csvData.data);
        fileChanged();
    };

    $scope.addRowBelow = function () {
        hideContextMenu();
        let row = {};
        Object.keys(csvData.data[0]).forEach(key => {
            row[key] = "";
        });
        csvData.data.splice(focusedCell.rowIndex + 1, 0, row);
        $scope.gridOptions.api.setRowData(csvData.data);
        fileChanged();
    };

    $scope.addRow = function () {
        hideContextMenu();
        let row = {};
        Object.keys(csvData.data[0]).forEach(key => {
            row[key] = "";
        });
        csvData.data.push(row);
        $scope.gridOptions.api.setRowData(csvData.data);
        fileChanged();
    };

    $scope.deleteRow = function () {
        hideContextMenu();
        csvData.data.splice(focusedCell.rowIndex, 1);
        $scope.gridOptions.api.setRowData(csvData.data);
        fileChanged();
    };

    $scope.addColumn = function () {
        hideContextMenu();
        let columnDefs = $scope.gridOptions.columnDefs;
        let column = {
            headerName: 'New column',
            field: `New column_${columnDefs.length + 1}`,
            headerComponentParams: {
                template:
                    `<div cid="${columnDefs.length}" class="ag-cell-label-container" role="presentation">` +
                    '  <span ref="eMenu" class="ag-header-icon ag-header-cell-menu-button"></span>' +
                    `  <div cid="${columnDefs.length}" ref="eLabel" class="ag-header-cell-label" role="presentation">` +
                    `    <input id="iid_${columnDefs.length}" class="header-input" type="text">` +
                    `    <span cid="${columnDefs.length}" id="tid_${columnDefs.length}" ref="eText" class="ag-header-cell-text" role="columnheader"></span>` +
                    '    <span ref="eSortOrder" class="ag-header-icon ag-sort-order" ></span>' +
                    '    <span ref="eSortAsc" class="ag-header-icon ag-sort-ascending-icon" ></span>' +
                    '    <span ref="eSortDesc" class="ag-header-icon ag-sort-descending-icon" ></span>' +
                    '    <span ref="eSortNone" class="ag-header-icon ag-sort-none-icon" ></span>' +
                    '    <span ref="eFilter" class="ag-header-icon ag-filter-icon"></span>' +
                    '  </div>' +
                    '</div>'
            }
        };
        columnDefs.push(column);
        $scope.gridOptions.api.setColumnDefs(columnDefs);
        fileChanged();
    };

    $scope.editColumn = function () {
        hideContextMenu();
        headerEditMode = true;
        let columnDefs = $scope.gridOptions.api.getColumnDefs();
        columnDefs[focusedColumnIndex].sortable = false;
        columnDefs[focusedColumnIndex].filter = false;
        $scope.gridOptions.api.setColumnDefs(columnDefs);
        showColumnInput();
    };

    $scope.deleteColumn = function () {
        hideContextMenu();
        let columnDefs = $scope.gridOptions.columnDefs;
        for (let i = 0; i < csvData.data.length; i++) {
            delete csvData.data[i][columnDefs[focusedColumnIndex].field];
        }
        columnDefs.splice(focusedColumnIndex, 1);
        $scope.gridOptions.api.setRowData(csvData.data);
        $scope.gridOptions.api.setColumnDefs(columnDefs);
        fileChanged();
    };

    function showColumnInput() {
        let columnInput = $(`#iid_${focusedColumnIndex}`);
        let columnText = $(`#tid_${focusedColumnIndex}`);
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
            let columnInput = $(`#iid_${focusedColumnIndex}`);
            let newTitle = columnInput.val();
            let columnText = $(`#tid_${focusedColumnIndex}`);
            columnInput.css({
                'display': 'none'
            });
            columnText.css({
                'display': 'inline-block'
            });
            columnInput.off();
            if (newTitle != columnText.text()) {
                let columnDefs = $scope.gridOptions.api.getColumnDefs();
                columnDefs[focusedColumnIndex].sortable = true;
                columnDefs[focusedColumnIndex].filter = true;
                columnDefs[focusedColumnIndex].headerName = newTitle;
                $scope.gridOptions.api.setColumnDefs(columnDefs);
                fileChanged();
            }
            headerEditMode = false;
        }
    };

    checkPlatform();
    load();

}]);