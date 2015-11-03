///////////////////////////////////////////////////////////////////////////
// Copyright © 2015 Esri. All Rights Reserved.
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
    "dojo/_base/declare",
    "dojo/_base/array",
    "dojo/_base/html",
    "dojo/_base/lang",
    "dojo/query",
    "dojo/on",
    "dojo/when",
    "dijit/_WidgetsInTemplateMixin",
    "jimu/BaseWidgetSetting",
    "jimu/LayerInfos/LayerInfos",
    "../utils",
    "./QuerySourceSetting",
    "./LocatorSourceSetting",
    "jimu/dijit/SimpleTable",
    "jimu/dijit/LoadingIndicator"
  ],
  function(
    declare, array, html, lang, query, on, when,
    _WidgetsInTemplateMixin, BaseWidgetSetting, LayerInfos, utils,
    QuerySourceSetting, LocatorSourceSetting) {
    /*jshint maxlen: 150*/
    /*jshint smarttabs:true */

    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-search-setting',
      _currentSourceSetting: null,

      postMixInProperties: function() {
        this.nls.countryCode = this.nls.countryCode || "Country Code(s)";
        this.nls.countryCodeEg = this.nls.countryCodeEg || "e.g. ";
        this.nls.countryCodeHint = this.nls.countryCodeHint ||
          "Leaving this value blank will search all countires";
      },

      startup: function() {
        this.inherited(arguments);

        if (!(this.config && this.config.sources)) {
          this.config.sources = [];
        }

        this.shelter.show();

        LayerInfos.getInstance(this.map, this.map.itemInfo)
          .then(lang.hitch(this, function(layerInfosObj) {
            this.layerInfosObj = layerInfosObj;
            utils.setMap(this.map);
            utils.setLayerInfosObj(this.layerInfosObj);
            utils.setAppConfig(this.appConfig);
            when(utils.getConfigInfo(this.config)).then(lang.hitch(this, function(config) {
              if (!this.domNode) {
                return;
              }
              this.setConfig(config);
              this.shelter.hide();
            }));
          }));
      },

      setConfig: function(config) {
        this.config = config;
        var sources = config.sources;
        array.forEach(sources, lang.hitch(this, function(source, index) {
          var addResult = this.sourceList.addRow({
            name: source.name || ""
          });

          if (addResult && addResult.success) {
            this._setRelatedConfig(addResult.tr, source);

            if (index === 0) {
              var firstTr = addResult.tr;
              setTimeout(lang.hitch(this, function() {
                this.sourceList.selectRow(addResult.tr);
                firstTr = null;
              }), 100);
            }
          } else {
            console.error("add row failed ", addResult);
          }
        }));
      },

      getConfig: function() {
        if (this._currentSourceSetting) {
          this._closeSourceSetting();
        }
        var trs = this.sourceList.getRows();
        var sources = [];
        array.forEach(trs, lang.hitch(this, function(tr) {
          var source = this._getRelatedConfig(tr);
          delete source._definition;
          this._removeRelatedConfig(tr);

          sources.push(source);
        }));

        return {
          "sources": sources
        };
      },

      _onMenuItemClick: function(evt) {
        // check fields
        if (this._currentSourceSetting && !this._currentSourceSetting.isValidConfig()) {
          this._currentSourceSetting.showValidationTip();
          return;
        }

        var itemType = evt && evt.target && html.getAttr(evt.target, "type");
        if (itemType === "locator") {
          // this._createNewLocatorSourceSetting();
          this._addNewLocator();
        } else if (itemType === "query") {
          this._addNewQuerySource();
        }
      },

      _addNewLocator: function() {
        var addResult = this.sourceList.addRow({
          name: "New Geocoder" //json.name
        });
        if (addResult && addResult.success) {
          this._createNewLocatorSourceSetting({}, {}, addResult.tr);
          this.sourceList.selectRow(addResult.tr);
          this._currentSourceSetting._onSetLocatorUrlClick();
        }
      },

      _addNewQuerySource: function() {
        var addResult = this.sourceList.addRow({
          // name: item.name || item.title
          name: "New FeatureLayer"
        });
        if (addResult.success) {
          this._createNewQuerySourceSetting({}, {}, addResult.tr);
          this.sourceList.selectRow(addResult.tr);
          // popup select feature layers
          this._currentSourceSetting._onSetSourceClick();
        }
      },

      _setRelatedConfig: function(tr, source) {
        query(tr).data('config', lang.clone(source));
      },

      _getRelatedConfig: function(tr) {
        return query(tr).data('config')[0];
      },

      _removeRelatedConfig: function(tr) {
        return query(tr).removeData('config');
      },

      _createNewLocatorSourceSetting: function(setting, definition, relatedTr) {
        if (this._currentSourceSetting) {
          this._closeSourceSetting();
        }

        this._currentSourceSetting = new LocatorSourceSetting({
          nls: this.nls
        });
        this._currentSourceSetting.placeAt(this.sourceSettingNode);
        this._currentSourceSetting.setDefinition(definition);
        this._currentSourceSetting.setConfig({
          url: setting.url || "",
          name: setting.name || "",
          singleLineFieldName: setting.singleLineFieldName || "",
          placeholder: setting.placeholder || "",
          countryCode: setting.countryCode || "",
          maxResults: setting.maxResults || 6,
          type: "locator"
        });
        this._currentSourceSetting.setRelatedTr(relatedTr);

        this._currentSourceSetting.own(
          on(this._currentSourceSetting, 'reset-locator-source', lang.hitch(this, function(item) {
            var tr = this._currentSourceSetting.getRelatedTr();
            this.sourceList.editRow(tr, {
              name: item.name || ""
            });
          }))
        );
      },

      _closeSourceSetting: function() {
        var tr = this._currentSourceSetting.getRelatedTr();
        var source = this._currentSourceSetting.getConfig();
        source._definition = this._currentSourceSetting.getDefinition();
        this._setRelatedConfig(tr, source);
        this.sourceList.editRow(tr, {
          name: source.name
        });
        this._currentSourceSetting.destroy();
      },

      _createNewQuerySourceSetting: function(setting, definition, relatedTr) {
        if (this._currentSourceSetting) {
          this._closeSourceSetting();
        }

        this._currentSourceSetting = new QuerySourceSetting({
          nls: this.nls,
          map: this.map,
          appConfig: this.appConfig
        });
        this._currentSourceSetting.placeAt(this.sourceSettingNode);
        this._currentSourceSetting.setDefinition(definition);
        this._currentSourceSetting.setConfig({
          url: setting.url,
          name: setting.name || "",
          layerId: setting.layerId,
          placeholder: setting.placeholder || "",
          searchFields: setting.searchFields || [],
          displayField: setting.displayField || definition.displayField || "",
          exactMatch: !!setting.exactMatch,
          maxResults: setting.maxResults || 6,
          type: "query"
        });
        this._currentSourceSetting.setRelatedTr(relatedTr);

        this._currentSourceSetting.own(
          on(this._currentSourceSetting, 'reset-query-source', lang.hitch(this, function(item) {
            var tr = this._currentSourceSetting.getRelatedTr();
            this.sourceList.editRow(tr, {
              name: item.name
            });
          }))
        );
      },

      _onSourceItemRemoved: function(tr) {
        if (!this._currentSourceSetting) {
          return;
        }

        var currentTr = this._currentSourceSetting.getRelatedTr();
        if (currentTr === tr) {
          this._currentSourceSetting.destroy();
          this._currentSourceSetting = null;
        }
      },

      _onSourceItemSelected: function(tr) {
        var config = this._getRelatedConfig(tr);
        var currentTr = this._currentSourceSetting && this._currentSourceSetting.tr;
        if (!config || tr === currentTr) {
          return;
        }

        // check fields
        if (this._currentSourceSetting && !this._currentSourceSetting.isValidConfig()) {
          this._currentSourceSetting.showValidationTip();
          this.sourceList.selectRow(currentTr);
          return;
        }

        if (config.type === "query") {
          this._createNewQuerySourceSetting(config, config._definition || {}, tr);
        } else if (config.type === "locator") {
          this._createNewLocatorSourceSetting(config, config._definition || {}, tr);
        }
      }
    });
  });