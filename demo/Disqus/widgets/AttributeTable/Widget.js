///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dojo/_base/declare',
    'dojo/_base/html',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidget',
    'dijit/layout/TabContainer',
    "dijit/layout/ContentPane",
    'jimu/utils',
    'jimu/dijit/Filter',
    'jimu/dijit/Popup',
    'jimu/dijit/Message',
    "dojo/Deferred",
    "dojo/when",
    "esri/layers/FeatureLayer",
    "esri/request",
    "esri/lang",
    'dojo/_base/lang',
    "dojo/on",
    'dojo/touch',
    'dojo/topic',
    'dojo/aspect',
    "dojo/_base/array",
    "dojo/has",
    "dojo/query",
    "dijit/Toolbar",
    "dijit/form/Button",
    "dijit/DropDownMenu",
    "dijit/MenuItem",
    "dijit/CheckedMenuItem",
    "dijit/form/DropDownButton",
    'jimu/dijit/LoadingIndicator',
    './_FeatureTable',
    './_RelationshipTable',
    './utils',
    './PopupHandler'
  ],
  function(
    declare,
    html,
    _WidgetsInTemplateMixin,
    BaseWidget,
    TabContainer,
    ContentPane,
    utils,
    Filter,
    Popup,
    Message,
    Deferred,
    when,
    FeatureLayer,
    esriRequest,
    esriLang,
    lang,
    on,
    touch,
    topic,
    aspect,
    array,
    has,
    domQuery,
    Toolbar,
    Button,
    DropDownMenu,
    MenuItem,
    CheckedMenuItem,
    DropDownButton,
    LoadingIndicator,
    _FeatureTable,
    _RelationshipTable,
    attrUtils,
    PopupHandler) {
    var clazz = declare([BaseWidget, _WidgetsInTemplateMixin], {
      /* global apiUrl */
      name: 'AttributeTable',
      baseClass: 'jimu-widget-attributetable',
      normalHeight: 0,
      openHeight: 0,
      arrowDivHeight: null,
      _defaultFeatureCount: 2000,
      _defaultBatchCount: 25,
      _batchCount: 0,

      // TODO: layerType: FeatureLayer,  RelationshipTable
      _layerTypes: {
        FEATURELAYER: 'FeatureLayer',
        RELATIONSHIPTABLE: 'RelationshipTable'
      },

      postMixInProperties: function() {
        this.nls.features = this.nls.features || 'features';
      },

      postCreate: function() {
        this.inherited(arguments);
        utils.loadStyleLink("dgrid", apiUrl + "dgrid/css/dgrid.css");
        this._loadInfoDef = null;
        this.AttributeTableDiv = null;
        // this.layers = [];
        this.configLayerInfos = []; // keep pace with this.config.layers
        this._delayedLayerInfos = [];
        this._allLayerInfos = [];
        this.grids = [];
        this.featureTables = [];
        this.layerTabPages = [];

        // one layer may be have multiple relationships, so we use key-value to store relationships
        this.relationshipsSet = {};
        this.relationTabPagesSet = {};
        this.relationshipTableSet = {};
        this.currentRelationshipKey = null;

        this.toolbarDiv = null;
        this.tabContainer = null;

        this.tableDiv = null;
        this.zoomButton = null;
        this.exportButton = null;
        this.selectionMenu = null;
        this.refreshButton = null;
        this.moveMode = false;
        this.moveY = 0;
        this.previousDomHeight = 0;
        // this.previousGridHeight = 0;
        this.noGridHeight = 0;
        this.toolbarHeight = 0;
        this.bottomPosition = 0;
        this.matchingCheckBox = null;
        this.layersIndex = -1;
        this.matchingMap = false;

        this.showing = false;

        // set initial position
        this.openHeight = this.normalHeight = this._getNormalHeight();
        this.arrowDivHeight = 0;

        // event handlers on draging
        this._dragingHandlers = [];

        this._createUtilitiesUI();

        // create PopupHandler
        this.popupHandler = new PopupHandler({
          map: this.map,
          attrWidget: this,
          nls: this.nls
        });

        this.own(topic.subscribe('changeMapPosition', lang.hitch(this, this._onMapPositionChange)));
        attrUtils.readLayerInfosObj(this.map).then(lang.hitch(this, function(layerInfosObj) {
          this.own(on(
            layerInfosObj,
            'layerInfosIsShowInMapChanged',
            lang.hitch(this, this.onLayerInfosIsShowInMapChanged)));
          this.own(layerInfosObj.on(
            'layerInfosChanged',
            lang.hitch(this, this.onLayerInfosChanged)));
        }));
      },

      _createUtilitiesUI: function() {
        this._createArrowUI();

        this._createBarUI();
      },

      _createArrowUI: function() {
        this.arrowDiv = html.create("div");
        html.addClass(this.arrowDiv, "jimu-widget-attributetable-move");
        html.create('div', {
          'class': "jimu-widget-attributetable-thumb"
        }, this.arrowDiv);
        html.place(this.arrowDiv, this.domNode);

        this.own(on(this.arrowDiv, 'mousedown', lang.hitch(this, this._onDragStart)));
        this.own(on(this.arrowDiv, touch.press, lang.hitch(this, this._onDragStart)));
      },

      _isOnlyTable: function() {
        return this.closeable || !this.isOnScreen;
      },

      _createBarUI: function() {
        if (!this._isOnlyTable()) {
          this.bar = html.create("div");
          html.addClass(this.bar, "jimu-widget-attributetable-bar");
          html.place(this.bar, this.domNode);
          this.own(on(this.bar, 'click', lang.hitch(this, this._switchTable)));
        }
      },

      _processOpenBarUI: function() {
        if (!this._isOnlyTable()) {
          html.removeClass(this.bar, 'close');
          html.addClass(this.bar, 'open');
          html.setAttr(this.bar, 'title', this.nls.closeTableTip);
        }
      },

      _processCloseBarUI: function() {
        if (!this._isOnlyTable()) {
          html.removeClass(this.bar, 'open');
          html.addClass(this.bar, 'close');
          html.setAttr(this.bar, 'title', this.nls.openTableTip);
        }
      },

      _switchTable: function() {
        if (!this.showing) {
          this._openTable();
        } else {
          this._closeTable();
        }
      },

      _openTable: function() {
        if (!this._loadInfoDef) {
          this._loadInfoDef = new Deferred();
          this.own(this._loadInfoDef);
          if (!this.loading) {
            this.loading = new LoadingIndicator();
          }
          this.loading.placeAt(this.domNode);
          this.loading.show();

          attrUtils.readConfigLayerInfosFromMap(this.map)
            .then(lang.hitch(this, function(layerInfos) {
              if (!this.domNode) {
                return;
              }
              if (this.config.layerInfos.length === 0) {
                // if no config only display visible layers
                var configLayerInfos = attrUtils.getConfigInfosFromLayerInfos(layerInfos);
                this.config.layerInfos = array.filter(configLayerInfos, function(layer) {
                  return layer.show;
                });
              } else {
                this.config.layerInfos = array.filter(
                  lang.delegate(this.config.layerInfos),
                  function(layerInfo) {
                    return layerInfo.show;
                  });
              }

              this._allLayerInfos = layerInfos;
              this._processDelayedLayerInfos();

              this._init();
              this.showRefreshing(false);

              this.showing = true;
              this._loadInfoDef.resolve();
            }), lang.hitch(this, function(err) {
              console.error(err);
            }));
        } else if (this._loadInfoDef.isFulfilled()) {
          this.showing = true;
        }
        this._changeLeftPostion();
        this._changeHeight(this.openHeight);
        this._processOpenBarUI();
        return this._loadInfoDef;
      },

      _onCloseBtnClicked: function() {
        if (this.showing && this._isOnlyTable()) {
          this.widgetManager.closeWidget(this);
        } else if (this.showing) {
          this._closeTable();
        }
      },

      _closeTable: function() {
        this._changeHeight(0);
        this.showRefreshing(false);
        this._processCloseBarUI();

        this.showing = false;

        // fix arrowDiv display on bottom when close table (only mobile)
        html.setStyle(this.arrowDiv, 'display', 'none');
        setTimeout(lang.hitch(this, function() {
          html.setStyle(this.arrowDiv, 'display', 'block');
        }), 10);
      },

      _init: function() {
        this.initConfigLayerInfos();
        this.initDiv();
        this.resize();

        // this.own(on(this.map, "extent-change", lang.hitch(this, this.onExtentChange)));
        this.own(on(window.document, "mouseup", lang.hitch(this, this._onDragEnd)));
        this.own(on(window.document, "mousemove", lang.hitch(this, this._onDraging)));
        this.own(on(window.document, touch.move, lang.hitch(this, this._onDraging)));
        this.own(on(window.document, touch.release, lang.hitch(this, this._onDragEnd)));
      },

      _processDelayedLayerInfos: function() { // must be invoke after initialize this._layerInfos
        if (this._delayedLayerInfos.length > 0) {
          array.forEach(this._delayedLayerInfos, lang.hitch(this, function(delayedLayerInfo) {
            if (!this._getLayerInfoById(delayedLayerInfo && delayedLayerInfo.id)) {
              this._allLayerInfos.push(delayedLayerInfo);
            }
          }));

          this._delayedLayerInfos = [];
        }
      },

      onLayerInfosIsShowInMapChanged: function() {
        this.checkMapInteractiveFeature();
      },

      onLayerInfosChanged: function(layerInfo, changeType, layerInfoSelf) {
        if (!layerInfoSelf || !layerInfo) {
          return;
        }
        if ('added' === changeType) {
          layerInfoSelf.getSupportTableInfo().then(lang.hitch(this, function(supportTableInfo) {
            if (supportTableInfo.isSupportedLayer) {
              if (this._allLayerInfos.length === 0) {
                this._delayedLayerInfos.push(layerInfoSelf);
              } else if (this._allLayerInfos.length > 0 &&
                !this._getLayerInfoById(layerInfoSelf.id)) {
                this._allLayerInfos.push(layerInfoSelf); // _allLayerInfos read from map
                this.initConfigLayerInfos();

                if (this.getExistLayerTabPage(layerInfoSelf.id)) {
                  var tabId = layerInfoSelf.id;
                  this._startQueryOnLayerTab(tabId);

                  this.resetButtonStatus();
                }
              }
            }
          }));
        } else if ('removed' === changeType) {
          var len = this.configLayerInfos.length;
          for (var i = 0; i < len; i++) {
            if (this.getLayerInfoId(this.configLayerInfos[i]) === this.getLayerInfoId(layerInfoSelf)) {
              this.layerTabPageClose(this.layerTabPages[i].paneId, true);
              break;
            }
          }
        }
      },

      destroy: function() {
        var len, i;
        len = this.layerTabPages.length;
        for (i = 0; i < len; i++) {
          this.layerTabPages[i].destroy();
        }
        this.layerTabPages = null;
        for (var p in this.relationTabPagesSet) {
          if (this.relationTabPagesSet[p]) {
            this.relationTabPagesSet[p].destroy();
          }
        }
        if (this.tabContainer) {
          this.tabContainer.destroy();
        }

        this.layers = null;
        this._allLayerInfos = null;
        this.configLayerInfos = null;
        this.layersIndex = -1;
        this.tableDiv = null;
        this.zoomButton = null;
        this.exportButton = null;
        if (this.selectionMenu) {
          this.selectionMenu.destroy();
        }
        this.selectionMenu = null;
        this.refreshButton = null;
        if (this.AttributeTableDiv) {
          html.empty(this.AttributeTableDiv);
          this.AttributeTableDiv = null;
        }
        this._loadInfoDef = null;

        this.popupHandler.destroy();
        this.inherited(arguments);
      },

      onOpen: function() {
        if (!this.showing && this._isOnlyTable()) {
          this._openTable();
        }
      },

      onClose: function() {
        if (this.showing) {
          this._closeTable();
        }
      },

      _changeHeight: function(h) {
        html.setStyle(this.domNode, "height", h + "px");
        if (this.tabContainer && this.tabContainer.domNode && (h - this.toolbarHeight >= 0)) {
          html.setStyle(this.tabContainer.domNode, "height", (h - this.toolbarHeight) + "px");
        }

        if (this.featureTables && this.featureTables.length > 0) {
          var len = this.featureTables.length;
          for (var i = 0; i < len; i++) {
            var fTable = this.featureTables[i];
            if (fTable) {
              fTable.changeHeight(h);
            }
          }
        }

        for (var p in this.relationshipTableSet) {
          var rTable = this.relationshipTableSet[p];
          if (rTable) {
            rTable.changeHeight(h);
          }
        }

        this.refreshGridHeight();
        topic.publish('changeMapPosition', {
          bottom: h + this.bottomPosition
        });

        if (h !== 0) {
          if (!this.arrowDivHeight) {
            var arrowDivBox = html.getMarginBox(this.arrowDiv);
            this.arrowDivHeight = arrowDivBox && arrowDivBox.h ? arrowDivBox.h : 10;
          }

          var minOpenHeight = this.arrowDivHeight + this.toolbarHeight;

          this.openHeight = (h >= minOpenHeight) ? h : this.normalHeight;
        }
      },

      _changeLeftPostion: function() {
        var mapBox = html.getMarginBox(this.map.id);
        var left = mapBox.l;
        if (window.isRTL) {
          html.setStyle(this.domNode, 'right', left + 'px');
        } else {
          html.setStyle(this.domNode, 'left', left + 'px');
        }
      },

      _onMapPositionChange: function() {
        this._changeLeftPostion();
        if (this.tabContainer) {
          this.tabContainer.resize();
        }
      },

      setPosition: function(position) {
        this.position = position;
        if (!this.domNode.parentNode || this.domNode.parentNode.id !== window.jimuConfig.layoutId) {
          html.place(this.domNode, window.jimuConfig.layoutId);
          this.setInitialPosition(position);

          this.refreshGridHeight();
          this.showRefreshing(false);
        }
      },

      initConfigLayerInfos: function() {
        var len = this.config.layerInfos.length;
        this.configLayerInfos = [];
        if (len > 0) {
          for (var i = 0; i < len; i++) {
            var layerInfo = this._getLayerInfoById(this.config.layerInfos[i].id);
            this.configLayerInfos[i] = layerInfo;
          }
        }
      },

      initSelectedLayer: function( /*layerObject, layersIndex*/ ) {
        // if (!this.layers[layersIndex]) {
        //   this.layers[layersIndex] = layerObject;
        //   this.graphicsLayers[layersIndex] = new GraphicsLayer();
        //   this.map.addLayer(this.graphicsLayers[layersIndex]);
        // this.own(on(
        //   layerObject,
        //   "click",
        //   lang.hitch(this, this.onGraphicClick, layersIndex)
        // ));
        // }
      },

      _getLayerInfoByName: function(name) {
        for (var i = 0; i < this._allLayerInfos.length; i++) {
          if (this._allLayerInfos[i] && this._allLayerInfos[i].name === name) {
            return this._allLayerInfos[i];
          }
        }
      },

      _getLayerInfoById: function(layerId) {
        for (var i = 0, len = this._allLayerInfos.length; i < len; i++) {
          if (this._allLayerInfos[i] && this._allLayerInfos[i].id === layerId) {
            return this._allLayerInfos[i];
          }
        }
      },

      _getRelationShipsByLayer: function(layer) {
        var ships = [];
        var _relships = layer.relationships;
        for (var p in this.relationshipsSet) {
          for (var i = 0, len = _relships.length; i < len; i++) {
            if (p === _relships[i]._relKey) {
              ships.push(_relships[i]);
            }
          }
        }

        return ships;
      },

      // onGraphicClick: function(index, event) {
      //   // if (!this.showing || index !== this.layersIndex) {
      //   //   return;
      //   // }
      //   // var id = event.graphic.attributes[this.layers[this.layersIndex].objectIdField] + "";
      //   // this.highlightRow(id);
      //   // this.selectFeatures("mapclick", [event.graphic]);
      // },

      // highlightRow: function(id) {
      //   // if (!this.showing) {
      //   //   return;
      //   // }
      //   // var store = this.grids[this.layersIndex].store;
      //   // var row = -1;
      //   // for (var i in store.index) {
      //   //   if (i === id) {
      //   //     row = store.index[i];
      //   //     break;
      //   //   }
      //   // }
      //   // if (row > -1) {
      //   //   var rowsPerPage = this.grids[this.layersIndex].get("rowsPerPage");
      //   //   var pages = parseInt(row / rowsPerPage, 10);
      //   //   pages++;

      //   //   this.grids[this.layersIndex].gotoPage(pages);
      //   //   this.grids[this.layersIndex].clearSelection();
      //   //   this.grids[this.layersIndex].select(id);
      //   //   this.resetButtonStatus();
      //   // }
      // },

      _getLayerDifinition: function(index) {
        var table = this.featureTables[index];
        var definition = table.getLayerDefinition();
        if (definition) {
          return when(definition);
        } else {
          return esriRequest({
            url: table.layer.url,
            content: {
              f: 'json'
            },
            handleAs: 'json',
            callbackParamName: 'callback'
          }).then(function(definition) {
            table.setLayerDefinition(definition);
            return table.getLayerDefinition();
          });
        }
      },

      _getFilterableFields: function(lFields, cFields) {
        return array.filter(lFields, function(lf) {
          return array.some(cFields, function(cf) {
            return lf.name === cf.name && (cf.show || !esriLang.isDefined(cf.show));
          });
        });
      },

      _clipValidFields: function(sFields, rFields) {
        if (!(sFields && sFields.length)) {
          return rFields || [];
        }
        if (!(rFields && rFields.length)) {
          return sFields;
        }
        var validFields = [];
        for (var i = 0, len = sFields.length; i < len; i++) {
          var sf = sFields[i];
          for (var j = 0, len2 = rFields.length; j < len2; j++) {
            var rf = rFields[j];
            if (rf.name === sf.name) {
              validFields.push(sf);
              break;
            }
          }
        }
        return validFields;
      },

      _getLayerIndexById: function(infoId) {
        var i = 0;
        var len = this.config.layerInfos.length;
        for (i = 0; i < len; i++) {
          if (this.configLayerInfos[i] &&
            this.getLayerInfoId(this.configLayerInfos[i]) === infoId) {
            return i;
          }
        }

        return -1;
      },

      _collectRelationShips: function(layerObject, layerInfo) {
        var ships = layerObject.relationships;
        if (ships && ships.length > 0) {
          for (var i = 0, len = ships.length; i < len; i++) {
            var relKey = layerInfo.id + '_' + ships[i].name + '_' + ships[i].id;
            ships[i]._relKey = relKey;
            ships[i]._layerInfoId = layerInfo.id;
            if (!this.relationshipsSet[relKey]) {
              this.relationshipsSet[relKey] = ships[i];
              this.relationshipsSet[relKey].objectIdField = layerObject.objectIdField;
            }
          }
        }
      },

      _startQueryOnLayerTab: function(tabId) {
        this.layersIndex = this._getLayerIndexById(tabId);

        if (this.layersIndex > -1 && this.configLayerInfos[this.layersIndex]) {
          array.forEach(this.featureTables, function(table) {
            if (table && table.grid) {
              table.actived = false;
            }
          });
          if (!this.config.layerInfos[this.layersIndex].opened) {
            this.configLayerInfos[this.layersIndex].getLayerObject()
              .then(lang.hitch(this, function(layerObject) {
                // persist relationships
                this._collectRelationShips(layerObject, this.config.layerInfos[this.layersIndex]);

                this.configLayerInfos[this.layersIndex].getSupportTableInfo()
                  .then(lang.hitch(this, function(tableInfo) {
                    if (tableInfo.isSupportQuery) {
                      // this.own(on(
                      //   layerObject,
                      //   "click",
                      //   lang.hitch(this, this.onGraphicClick, layersIndex)
                      // ));
                      this.checkMapInteractiveFeature();
                      var configFields = this.config.layerInfos[this.layersIndex].layer.fields;
                      var layerFields = layerObject.fields;
                      // remove fields not exist in layerObject.fields
                      this.config.layerInfos[this.layersIndex].layer.fields = this._clipValidFields(
                        configFields,
                        layerFields
                      );

                      if (this.matchingMap) {
                        this.startQuery(this.layersIndex, this.map.extent);
                      } else {
                        this.startQuery(this.layersIndex);
                        this.config.layerInfos[this.layersIndex].opened = true;
                      }
                      this.featureTables[this.layersIndex].actived = true;
                    } else {
                      var tip = html.toDom('<div>' + this.nls.unsupportQueryWarning + '</div>');
                      html.empty(this.layerTabPages[this.layersIndex].content);
                      html.place(tip, this.layerTabPages[this.layersIndex].content);

                      this.refreshGridHeight();
                      this.resetButtonStatus();
                    }
                  }), lang.hitch(this, function(err) {
                    new Message({
                      message: err.message || err
                    });
                  }));
              }), lang.hitch(this, function(err) {
                new Message({
                  message: err.message || err
                });
              }));
          } else {
            this.featureTables[this.layersIndex].actived = true;
            if (this.matchingMap) {
              this.startQuery(this.layersIndex, this.map.extent);
            } else {
              this.resetButtonStatus();
            }
          }
        }
      },

      _startQueryOnRelationTab: function(relationShipKey, selectedIds, layersIndex) {
        var rTable = this.relationshipTableSet[relationShipKey];
        var layerInfo = this.configLayerInfos[layersIndex];
        if (!(layerInfo && layerInfo.layerObject)) {
          return;
        }

        if (rTable) {
          this.relationshipTableSet[relationShipKey].startQuery(layerInfo.layerObject, selectedIds);
        } else {
          var ship = this.relationshipsSet[relationShipKey];
          var relationshipTable = new _RelationshipTable({
            relationship: ship,
            parentWidget: this,
            noGridHeight: this.noGridHeight,
            nls: this.nls
          });
          var tabPage = this.relationTabPagesSet[relationShipKey];
          relationshipTable.placeAt(tabPage);
          relationshipTable.startQuery(layerInfo.layerObject, selectedIds);
          relationshipTable.own(on(relationshipTable,
            'data-loaded',
            lang.hitch(this, '_onTableDataLoaded')));
          relationshipTable.own(on(relationshipTable,
            'row-click',
            lang.hitch(this, '_onTableRowClick')));
          relationshipTable.own(on(relationshipTable,
            'clear-selection',
            lang.hitch(this, '_onTableClearSelection')));
          this.relationshipTableSet[relationShipKey] = relationshipTable;
        }
      },

      tabChanged: function() {
        if (this.exportButton) {
          this.exportButton.set('disabled', true);
        }
        if (this.tabContainer && this.tabContainer.selectedChildWidget) {
          var layerType = this.tabContainer.selectedChildWidget.params.layerType;
          if (layerType === this._layerTypes.FEATURELAYER) {
            var tabId = this.tabContainer.selectedChildWidget.params.paneId;
            this.currentRelationshipKey = null;
            this._startQueryOnLayerTab(tabId);
          } else if (layerType === this._layerTypes.RELATIONSHIPTABLE) {
            var params = this.tabContainer.selectedChildWidget.params;
            var _relKey = params.paneId;
            var selectIds = params.oids;
            var layersIndex = params.layersIndex;
            this.currentRelationshipKey = _relKey;
            var currentShip = this.relationshipsSet[_relKey];
            if (currentShip) {
              this._startQueryOnRelationTab(_relKey, selectIds, layersIndex);
            }
          }

          // this.onMapResize();
        }
        this.resetButtonStatus();
      },

      getCurrentTable: function() {
        if (this.tabContainer && this.tabContainer.selectedChildWidget) {
          var layerType = this.tabContainer.selectedChildWidget.params.layerType;
          if (layerType === this._layerTypes.FEATURELAYER) {
            return this.featureTables[this.layersIndex];
          } else if (layerType === this._layerTypes.RELATIONSHIPTABLE) {
            return this.relationshipTableSet[this.currentRelationshipKey];
          }
        }

        return null;
      },

      checkMapInteractiveFeature: function() {
        var currentLayerInfo = this.configLayerInfos[this.layersIndex];
        var currentFeatureTable = this.featureTables[this.layersIndex];
        if (!currentLayerInfo) {
          return;
        }

        if (currentLayerInfo.isShowInMap()) {
          if (currentFeatureTable) {
            currentFeatureTable.showGraphic();
          }
          this.zoomButton.set('disabled', false);
        } else {
          if (currentFeatureTable) {
            currentFeatureTable.hideGraphic();
          }
          this.zoomButton.set('disabled', true);
        }
      },

      resetButtonStatus: function() {
        var table = this.getCurrentTable();
        if (!table) {
          this.showSelectedRecords.set('disabled', true);
          this.showRelatedRecords.set('disabled', true);
          this.matchingCheckBox.set('disabled', true);
          if (!this.config.hideExportButton) {
            this.exportButton.set('disabled', true);
          }
          this.zoomButton.set('disabled', true);
          return;
        }

        var selectionRows = table.getSelectedRows();
        if (selectionRows && selectionRows.length > 0) {
          this.showSelectedRecords.set('disabled', false);
        } else {
          this.showSelectedRecords.set('disabled', true);
        }

        if (table.layer && table.layer.relationships &&
          table.layer.relationships.length > 0 &&
          selectionRows && selectionRows.length > 0) {
          this.showRelatedRecords.set('disabled', false);
        } else {
          this.showRelatedRecords.set('disabled', true);
        }

        if (table instanceof _FeatureTable && table.isSupportQueryToServer()) {
          this.filter.set('disabled', false);
        } else {
          this.filter.set('disabled', true);
        }

        if (table instanceof _FeatureTable) {
          this.matchingCheckBox.set('disabled', false);
        } else {
          this.matchingCheckBox.set('disabled', true);
        }

        if (!this.config.hideExportButton) {
          var hasStore = table.grid && table.grid.store;
          if (hasStore) {
            this.exportButton.set('disabled', false);
          } else {
            this.exportButton.set('disabled', true);
          }
        }


        if (table instanceof _FeatureTable && selectionRows && selectionRows.length > 0) {
          var currentLayerInfo = this.configLayerInfos[this.layersIndex];
          if (currentLayerInfo.isShowInMap()) {
            this.zoomButton.set('disabled', false);
          } else {
            this.zoomButton.set('disabled', true);
          }
        } else {
          this.zoomButton.set('disabled', true);
        }
      },

      showRefreshing: function(refresh) {
        if (!this.loading) {
          return;
        }

        if (refresh) {
          this.loading.show();
        } else {
          this.loading.hide();
        }
      },

      startQuery: function(index, extent) {
        if (!this.config.layerInfos || this.config.layerInfos.length === 0) {
          return;
        }

        if (this.featureTables[this.layersIndex]) {
          this.featureTables[this.layersIndex].startQuery(extent);
        } else {
          var featureTable = new _FeatureTable({
            map: this.map,
            matchingMap: this.matchingCheckBox.get('checked'),
            layerInfo: this.configLayerInfos[index],
            configedInfo: this.config.layerInfos[index],
            parentWidget: this,
            noGridHeight: this.noGridHeight,
            nls: this.nls
          });
          var tabPage = this.layerTabPages[index];
          featureTable.placeAt(tabPage);
          featureTable.startQuery(extent);

          featureTable.own(on(featureTable, 'data-loaded', lang.hitch(this, '_onTableDataLoaded')));
          featureTable.own(on(featureTable, 'row-click', lang.hitch(this, '_onTableRowClick')));
          featureTable.own(on(featureTable,
            'clear-selection',
            lang.hitch(this, '_onTableClearSelection')));
          this.featureTables[index] = featureTable;
        }
        this.featureTables[this.layersIndex].actived = true;
      },

      _onTableDataLoaded: function() {
        this.showRefreshing(false);

        this.refreshGridHeight();
        this.resetButtonStatus();
      },

      _onTableRowClick: function() {
        this.resetButtonStatus();
      },

      _onTableClearSelection: function() {
        this.resetButtonStatus();
      },

      _onDragStart: function(evt) {
        this.moveMode = true;
        this.moveY = evt.clientY;
        this.previousDomHeight = html.getStyle(this.domNode, "height");
        html.addClass(this.arrowDiv, "draging");

        this._dragingHandlers = this._dragingHandlers.concat([
          on(this.ownerDocument, 'dragstart', function(e) {
            e.stopPropagation();
            e.preventDefault();
          }),
          on(this.ownerDocumentBody, 'selectstart', function(e) {
            e.stopPropagation();
            e.preventDefault();
          })
        ]);
      },

      _onDraging: function(evt) {
        if (this.moveMode) {
          var y = this.moveY - evt.clientY;
          this._changeHeight(y + this.previousDomHeight);
        }
      },

      _onDragEnd: function() {
        this.moveMode = false;
        html.removeClass(this.arrowDiv, "draging");

        var h = this._dragingHandlers.pop();
        while (h) {
          h.remove();
          h = this._dragingHandlers.pop();
        }
      },

      refreshGridHeight: function() {
        var tab = domQuery(".dijitTabPaneWrapper", this.domNode);
        if (tab && tab.length) {
          html.setStyle(tab[0], "height", "100%"); //larger than grid 40px
        }
      },

      _getNormalHeight: function() {
        var h = document.body.clientHeight;
        return window.appInfo.isRunInMobile ? h / 2 : h / 3;
      },

      setInitialPosition: function(position) {
        // Attribute Table decide position by itself.
        if ("bottom" in position) {
          this.bottomPosition = parseInt(position.bottom, 10);
        } else {
          this.bottomPosition = 0;
        }

        html.setStyle(this.domNode, "top", "auto");
        html.setStyle(this.domNode, "left", "0px");
        html.setStyle(this.domNode, "right", "0px");
        html.setStyle(this.domNode, "bottom", this.bottomPosition + "px");
        html.setStyle(this.domNode, "position", "absolute");

        if (!this._isOnlyTable()) {
          if (this.config && this.config.initiallyExpand) {
            this._openTable();
          } else {
            this._closeTable();
          }
        } // else use openAtStart by widgetManager or controller
      },

      initDiv: function() {
        this.AttributeTableDiv = html.create("div", {}, this.domNode);
        html.addClass(this.AttributeTableDiv, "jimu-widget-attributetable-main");

        var toolbarDiv = html.create("div");
        this.toolbarDiv = toolbarDiv;
        var toolbar = new Toolbar({}, html.create("div"));

        var menus = new DropDownMenu();

        this.showSelectedRecords = new MenuItem({
          label: this.nls.showSelectedRecords,
          iconClass: "esriAttributeTableSelectPageImage",
          onClick: lang.hitch(this, this._showSelectedRecords)
        });
        menus.addChild(this.showSelectedRecords);

        this.showRelatedRecords = new MenuItem({
          label: this.nls.showRelatedRecords,
          iconClass: "esriAttributeTableSelectAllImage",
          onClick: lang.hitch(this, this._showRelatedRecords)
        });
        menus.addChild(this.showRelatedRecords);

        this.filter = new MenuItem({
          label: this.nls.filter,
          iconClass: "esriAttributeTableFilterImage",
          onClick: lang.hitch(this, this._showFilter)
        });
        menus.addChild(this.filter);

        this.matchingCheckBox = new CheckedMenuItem({
          checked: false,
          // style: "margin-left:10px;margin-right:10px;",
          label: this.nls.filterByExtent,
          onChange: lang.hitch(this, function(status) {
            this.matchingMap = status;
            if (status) {
              array.forEach(this.featureTables, lang.hitch(this, function(table) {
                if (table) {
                  table.set('matchingMap', true);
                }
              }));
              this.startQuery(this.layersIndex, this.map.extent);
            } else {
              array.forEach(this.featureTables, lang.hitch(this, function(table) {
                if (table) {
                  table.set('matchingMap', false);
                }
              }));
              this.startQuery(this.layersIndex);
            }
          })
        });
        menus.addChild(this.matchingCheckBox);

        var columns = new MenuItem({
          label: this.nls.columns,
          iconClass: "esriAttributeTableColumnsImage",
          onClick: lang.hitch(this, this._toggleColumns)
        });
        menus.addChild(columns);

        if (!this.config.hideExportButton) {
          // always set exportButton to true
          this.exportButton = new MenuItem({
            label: this.nls.exportFiles,
            showLabel: true,
            iconClass: "esriAttributeTableExportImage",
            onClick: lang.hitch(this, this._onExportButton)
          });
          menus.addChild(this.exportButton);
        }

        this.selectionMenu = new DropDownButton({
          label: this.nls.options,
          iconClass: "esriAttributeTableOptionsImage",
          dropDown: menus
        });
        toolbar.addChild(this.selectionMenu);

        this.zoomButton = new Button({
          label: this.nls.zoomto,
          iconClass: "esriAttributeTableZoomImage",
          onClick: lang.hitch(this, this.onZoomButton)
        });
        toolbar.addChild(this.zoomButton);

        var clearSelectionButton = new Button({
          label: this.nls.clearSelection,
          iconClass: "esriAttributeTableClearImage",
          onClick: lang.hitch(this, this._clearSelection, false)
        });
        toolbar.addChild(clearSelectionButton);

        this.refreshButton = new Button({
          label: this.nls.refresh,
          showLabel: true,
          iconClass: "esriAttributeTableRefreshImage",
          onClick: lang.hitch(this, this.onClickRefreshButton)
        });
        toolbar.addChild(this.refreshButton);

        this.closeButton = new Button({
          title: this.nls.closeMessage,
          iconClass: "esriAttributeTableCloseImage",
          onClick: lang.hitch(this, this._onCloseBtnClicked)
        });
        html.addClass(this.closeButton.domNode, 'close-button');
        toolbar.addChild(this.closeButton);

        html.place(toolbar.domNode, toolbarDiv);

        var tabDiv = html.create("div");
        this.tableDiv = html.create("div");
        html.place(this.tableDiv, tabDiv);
        html.place(toolbarDiv, this.AttributeTableDiv);
        html.place(tabDiv, this.AttributeTableDiv);

        var height = html.getStyle(toolbarDiv, "height");
        this.toolbarHeight = height;
        this.tabContainer = new TabContainer({
          style: "width: 100%;"
        }, tabDiv);
        html.setStyle(this.tabContainer.domNode, 'height', (this.normalHeight - height) + 'px');
        var len = this.config.layerInfos.length;
        for (var j = 0; j < len; j++) {
          if (this.config.layerInfos[j].show) {
            var json = lang.clone(this.config.layerInfos[j]);
            var paneJson = {};

            paneJson.paneId = json.id;
            paneJson.title = json.name;
            paneJson.name = json.name;
            paneJson.layerType = this._layerTypes.FEATURELAYER;
            paneJson.style = "height: 100%; width: 100%; overflow: visible;";
            var cp = new ContentPane(paneJson);
            this.layerTabPages[j] = cp;
            this.tabContainer.addChild(cp);
          }
        }
        this.tabContainer.startup();

        // toolbarHeight + tabListWrapperHeight + tolerance
        this.noGridHeight = this._getGridTopSectionHeight() + 5;

        // vertical center
        utils.setVerticalCenter(this.tabContainer.domNode);
        this.tabChanged();
        this.own(aspect.after(this.tabContainer, "selectChild", lang.hitch(this, this.tabChanged)));
      },

      getLayerInfoLabel: function(layerInfo) {
        var label = layerInfo.name || layerInfo.title;
        return label;
      },

      getLayerInfoId: function(layerInfo) {
        return layerInfo && layerInfo.id || "";
      },

      _getGridTopSectionHeight: function() {
        var tabPageWrapper = domQuery('.dijitTabPaneWrapper', this.domNode)[0];
        if (tabPageWrapper) {
          var widgetTop = html.position(this.domNode).y;
          var tabPaneTop = html.position(tabPageWrapper).y;
          return tabPaneTop - widgetTop;
        } else {
          return 0;
        }
      },

      _showSelectedRecords: function() {
        var table = this.getCurrentTable();
        if (table) {
          table.showSelectedRecords();
        }
      },

      _showRelatedRecords: function() {
        var layerInfo = this.configLayerInfos[this.layersIndex];
        if (layerInfo && layerInfo.layerObject) {
          var _layer = layerInfo.layerObject;
          var ships = _layer.relationships;
          var objIds = this.featureTables[this.layersIndex].getSelectedRows();

          for (var i = 0, len = ships.length; i < len; i++) {
            this.addNewRelationTab(objIds, ships[i], this.layersIndex);
          }
        }
      },

      _showFilter: function() {
        this.showRefreshing(true);

        this._getLayerDifinition(this.layersIndex).then(lang.hitch(this, function(definition) {
          if (!this.domNode) {
            return;
          }
          var table = this.featureTables[this.layersIndex];

          var cFields = this.config.layerInfos[this.layersIndex].layer.fields;
          var fFields = this._getFilterableFields(definition.fields, cFields);
          definition.fields = fFields;

          var filter = new Filter({
            noFilterTip: this.nls.noFilterTip,
            style: "width:100%;margin-top:22px;"
          });
          var filterPopup = new Popup({
            titleLabel: this.nls.filter,
            width: 680,
            height: 485,
            content: filter,
            buttons: [{
              label: this.nls.ok,
              onClick: lang.hitch(this, function() {
                var partsObj = filter.toJson();
                if (partsObj && partsObj.expr) {
                  table.setFilterObj(partsObj);
                  table.startQuery();
                  filterPopup.close();
                  filterPopup = null;
                } else {
                  new Message({
                    message: this.nls.setFilterTip
                  });
                }
              })
            }, {
              label: this.nls.cancel
            }]
          });
          var filterObj = table.getFilterObj();
          if (filterObj) {
            filter.buildByFilterObj(table.layer.url, filterObj, definition);
          } else {
            filter.buildByExpr(table.layer.url, null, definition);
          }
        }), lang.hitch(this, function(err) {
          if (!this.domNode) {
            return;
          }
          console.error(err);
        })).always(lang.hitch(this, function() {
          this.showRefreshing(false);
        }));
      },

      _toggleColumns: function() {
        var table = this.getCurrentTable();
        if (table) {
          table.toggleColumns();
        }
      },

      _onExportButton: function() {
        if (!this.config.layerInfos || this.config.layerInfos.length === 0) {
          return;
        }
        var popup = new Message({
          message: this.nls.exportMessage,
          titleLabel: this.nls.exportFiles,
          autoHeight: true,
          buttons: [{
            label: this.nls.ok,
            onClick: lang.hitch(this, function() {
              this.exportToCSV();
              popup.close();
            })
          }, {
            label: this.nls.cancel,
            onClick: lang.hitch(this, function() {
              popup.close();
            })
          }]
        });
      },

      onZoomButton: function() {
        var table = this.getCurrentTable();
        if (table) {
          table.zoomTo();
        }
      },

      onClickRefreshButton: function() {
        var table = this.getCurrentTable();
        if (!table) {
          return;
        }

        if (table.grid) {
          table.grid.clearSelection();
        }

        if (table instanceof _FeatureTable) {
          this.startQuery(this.layersIndex, this.config.layerInfos[this.layersIndex].extent);
        } else {
          this.relationshipsSet[this.currentRelationshipKey].opened = false;
          this._startQueryOnRelationTab(this.currentRelationshipKey);
        }
      },

      _clearSelection: function() {
        var table = this.getCurrentTable();
        if (table) {
          table.clearSelection();
        }
      },

      exportToCSV: function() {
        var params = this.tabContainer.selectedChildWidget.params;
        var table = this.getCurrentTable();
        if (table) {
          table.exportToCSV().then(lang.hitch(this, function(content) {
            this.download(params.title + ".csv", content);
          }));
        }
      },

      _isIE11: function() {
        var iev = 0;
        var ieold = (/MSIE (\d+\.\d+);/.test(navigator.userAgent));
        var trident = !!navigator.userAgent.match(/Trident\/7.0/);
        var rv = navigator.userAgent.indexOf("rv:11.0");

        if (ieold) {
          iev = Number(RegExp.$1);
        }
        if (navigator.appVersion.indexOf("MSIE 10") !== -1) {
          iev = 10;
        }
        if (trident && rv !== -1) {
          iev = 11;
        }

        return iev === 11;
      },

      download: function(filename, text) {
        if (has("ie") || this._isIE11()) { // has module unable identify ie11
          var oWin = window.top.open("about:blank", "_blank");
          oWin.document.write(text);
          oWin.document.close();
          oWin.document.execCommand('SaveAs', true, filename);
          oWin.close();
        } else {
          var link = html.create("a", {
            href: 'data:attachment/csv;charset=utf-8,' + encodeURIComponent(text),
            target: '_blank',
            download: filename
          }, this.domNode);
          if (has('safari')) {
            // # First create an event
            var click_ev = document.createEvent("MouseEvents");
            // # initialize the event
            click_ev.initEvent("click", true /* bubble */ , true /* cancelable */ );
            // # trigger the evevnt/
            link.dispatchEvent(click_ev);
          } else {
            link.click();
          }

          html.destroy(link);
        }
      },

      addNewLayerTab: function(params) {
        var layerInfo = this._getLayerInfoById(params.layer.id) ||
          this._getLayerInfoByName(params.layer.name);
        var infoId = this.getLayerInfoId(layerInfo);
        var page = this.getExistLayerTabPage(infoId);
        if (page) {
          this.onOpen();
          this.tabContainer.selectChild(page);
          this.tabChanged();
        } else {
          var info = attrUtils.getConfigInfoFromLayerInfo(layerInfo);
          this.config.layerInfos.push({
            id: info.id,
            name: info.name,
            layer: {
              url: info.layer.url,
              fields: info.layer.fields
            }
          });
          this.configLayerInfos.push(layerInfo);
          this.onOpen();

          var json = {};
          json.title = this.getLayerInfoLabel(layerInfo);
          json.name = json.title;
          json.paneId = this.getLayerInfoId(layerInfo);
          json.closable = true;
          json.layerType = this._layerTypes.FEATURELAYER;
          json.style = "height: 100%; width: 100%; overflow: visible";
          var cp = new ContentPane(json);
          this.layerTabPages.push(cp);

          cp.set("title", json.name);
          this.own(on(cp, "close", lang.hitch(this, this.layerTabPageClose, json.paneId)));
          this.tabContainer.addChild(cp);
          this.tabContainer.selectChild(cp);
        }
      },

      addNewRelationTab: function(oids, relationShip, layersIndex) {
        var page = this.getExistRelationTabPage(relationShip._relKey);

        if (page) {
          relationShip.opened = false;
          page.params.oids = oids;
          this.tabContainer.selectChild(page);
        } else {
          var json = {};
          json.oids = oids;
          json.title = relationShip.name;
          json.name = json.title;
          json.paneId = relationShip._relKey;
          json.layersIndex = layersIndex;
          json.closable = true;
          json.layerType = this._layerTypes.RELATIONSHIPTABLE;
          json.style = "height: 100%; width: 100%; overflow: visible";
          var cp = new ContentPane(json);
          this.relationTabPagesSet[relationShip._relKey] = cp;
          cp.set("title", json.name);
          this.own(on(cp, "close", lang.hitch(this, this.relationTabPageClose, json.paneId)));
          this.tabContainer.addChild(cp);
          this.tabContainer.selectChild(cp);
        }
      },

      onReceiveData: function(name, source, params) {
        /*jshint unused:vars*/
        if (params && params.target === "AttributeTable") {
          if (this._isOnlyTable()) {
            if (this.state === 'closed') {
              console.warn('Please open Attribute Table!');
              return;
            }
          }

          if (!this.showing) {
            this._openTable().then(lang.hitch(this, this._addLayerToTable, params));
          } else {
            attrUtils.readConfigLayerInfosFromMap(this.map)
              .then(lang.hitch(this, function(layerInfos) {
                this._allLayerInfos = layerInfos;
                this._processDelayedLayerInfos();
                this._addLayerToTable(params);
              }));
          }
        }
      },

      _addLayerToTable: function(params) {
        var layer = null;
        params.layer.getLayerObject().then(lang.hitch(this, function(layerObject) {
          if (layerObject) {
            layerObject.id = params.layer.id;
            if (layerObject.loaded) {
              this.addNewLayerTab({
                layer: layerObject
              });
            } else {
              this.own(on(layerObject, "load", lang.hitch(this, this.addNewLayerTab)));
            }
          } else if (params.url) {
            layer = new FeatureLayer(params.url);
            this.own(on(layer, "load", lang.hitch(this, this.addNewLayerTab)));
          }
        }), lang.hitch(this, function(err) {
          new Message({
            message: err.message || err
          });
        }));
      },

      getExistLayerTabPage: function(paneId) {
        var len = this.layerTabPages.length;
        for (var i = 0; i < len; i++) {
          if (this.layerTabPages[i] && this.layerTabPages[i].get('paneId') === paneId) {
            return this.layerTabPages[i];
          }
        }
        return null;
      },

      getExistRelationTabPage: function(name) {
        return this.relationTabPagesSet[name];
      },

      layerTabPageClose: function(paneId, isRemoveChild) {
        var len = this.layerTabPages.length;
        for (var i = 0; i < len; i++) {
          if (this.layerTabPages[i] && this.layerTabPages[i].paneId === paneId) {
            if (isRemoveChild === true) {
              this.tabContainer.removeChild(this.layerTabPages[i]);
            }
            if (this.featureTables && this.featureTables.length >= i) {
              if (this.featureTables[i]) {
                this.featureTables[i].destroy();
              }

              this.featureTables.splice(i, 1);
            }
            if (this.layerTabPages && this.layerTabPages[i]) {
              this.layerTabPages[i].destroyDescendants();
              this.layerTabPages.splice(i, 1);
            }
            if (this.config && this.config.layerInfos && this.config.layerInfos[i]) {
              this.config.layerInfos.splice(i, 1);
              this.configLayerInfos.splice(i, 1);
              var pos = this._getLayerIndexById(paneId);
              this._allLayerInfos.splice(pos, 1);
            }
            if (len === 1) {
              this.layersIndex = -1;
              this.onClose();
              return;
            } else {
              if (i < this.layersIndex) {
                this.layersIndex--;
              } else if (i === this.layersIndex) {
                if (len > 1) {
                  this.layersIndex = len - 2;
                  this.tabContainer.selectChild(this.layerTabPages[this.layersIndex]);
                  this.tabChanged();
                } else {
                  this.layersIndex = 0;
                }
              }
            }
            break;
          }
        }
        setTimeout(lang.hitch(this, function() {
          this.refreshGridHeight();
        }), 10);
      },

      relationTabPageClose: function(relationShipKey) {
        var page = this.getExistRelationTabPage(relationShipKey);
        if (!page) {
          return;
        }

        this.tabContainer.removeChild(page);

        if (this.relationshipTableSet[relationShipKey]) {
          this.relationshipTableSet[relationShipKey].destroy();
          this.relationshipTableSet[relationShipKey] = null;
        }
        if (page) {
          page.destroyDescendants();
          page.destroy();
          this.relationTabPagesSet[relationShipKey] = null;
        }

        this.currentRelationshipKey = null;
        this.relationshipsSet[relationShipKey].opened = false;
        setTimeout(lang.hitch(this, function() {
          this.refreshGridHeight();
        }), 10);
      },

      _processRelatedRecordsFromPopup: function(layerInfo, featureIds) {
        var layersIndex = this._getLayerIndexById(layerInfo.id);

        if (layersIndex > -1 && this.configLayerInfos[layersIndex]) {
          this.configLayerInfos[layersIndex].getLayerObject()
            .then(lang.hitch(this, function(layerObject) {
              this.initSelectedLayer(layerObject, layersIndex);
              this._collectRelationShips(layerObject, layerInfo);
              var ships = layerObject.relationships;
              for (var i = 0, len = ships.length; i < len; i++) {
                this.addNewRelationTab(featureIds, ships[i], layersIndex);
              }
            }));
        }
      },

      showRelatedRecordsFromPopup: function(layerInfo, featureIds) {
        if (!this.showing) {
          this._openTable()
            .then(lang.hitch(this, this._processRelatedRecordsFromPopup, layerInfo, featureIds));
        } else {
          attrUtils.readConfigLayerInfosFromMap(this.map)
            .then(lang.hitch(this, function(layerInfos) {
              this._allLayerInfos = layerInfos;
              this._processDelayedLayerInfos();
              this._processRelatedRecordsFromPopup(layerInfo, featureIds);
            }));
        }

      }
    });

    clazz.inPanel = false;
    clazz.hasUIFile = false;
    return clazz;
  });