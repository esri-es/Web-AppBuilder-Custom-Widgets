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

define(['dojo/_base/lang',
  'dojo/_base/array',
  'jimu/LayerInfos/LayerInfos',
  'dojo/Deferred',
  'dojo/promise/all',
  'exports',
  "dojo/store/Observable",
  "dojo/store/Cache",
  "dojo/store/Memory",
  "esri/lang",
  './FeatureLayerQueryStore',
  'jimu/utils'
], function(
  lang, array, LayerInfos, Deferred, all,
  exports, Observable, Cache, Memory, esriLang,
  FeatureLayerQueryStore, utils
) {
  exports.readLayerInfosObj = function(map) {
    return LayerInfos.getInstance(map, map.itemInfo);
  };

  exports.readLayerInfosFromMap = function(map) {
    var def = new Deferred();
    LayerInfos.getInstance(map, map.itemInfo).then(lang.hitch(this, function(layerInfosObj) {
      var layerInfos = [];
      layerInfosObj.traversal(lang.hitch(this, function(layerInfo) {
        layerInfos.push(layerInfo);
      }));
      var tableInfos = layerInfosObj.getTableInfoArray();
      layerInfos = layerInfos.concat(tableInfos);

      def.resolve(layerInfos);
    }), lang.hitch(this, function(err) {
      console.error(err);
      def.reject(err);
    }));

    return def.promise;
  };

  exports.createCSVStr = function(data, _outFields, pk, types) {
    var def = new Deferred();
    var textField = '"';
    var content = "";
    var len = 0,
      n = 0,
      comma = "",
      value = "";
    try {
      array.forEach(_outFields, function(_field) {
        content = content + comma + (_field.alias || _field.name);
        comma = ",";
      });

      content = content + "\r\n";
      len = data.length;
      n = _outFields.length;
      for (var i = 0; i < len; i++) {
        comma = "";
        for (var m = 0; m < n; m++) {
          var _field = _outFields[m];
          value = exports.getExportValue(
            data[i][_field.name],
            _field,
            pk,
            data[i][pk],
            types
          );
          if (!value && typeof value !== "number") {
            value = "";
          }
          if (value && /[",]/g.test(value)) {
            value = textField + value.replace(/(")/g, '""') + textField;
          }
          content = content + comma + value;
          comma = ",";
        }
        content = content + "\r\n";
      }
      def.resolve(content);
    } catch (err) {
      console.error(err);
      def.resolve("");
    }

    return def;
  };

  exports.getExportValue = function(data, field, pk, pkData, types) {
    var isDomain = !!field.domain;
    var isDate = field.type === "esriFieldTypeDate";
    var isTypeIdField = pk && (field.name === pk);

    if (isDate) {
      return exports.dateFormatter(data);
    }
    if (isDomain) {
      return exports.getCodeValue(field.domain, data);
    }
    if (!isDomain && !isDate && !isTypeIdField) {
      var codeValue = null;
      if (pk && types && types.length > 0) {
        var typeCheck = array.filter(types, function(item) {
          // value of typeIdFild has been changed above
          return item.name === pkData;
        });

        if (typeCheck && typeCheck.domains &&
          typeCheck.domains[field.name] && typeCheck.domains[field.name].codedValues) {
          codeValue = exports.getCodeValue(
            typeCheck.domains[field.name],
            data
          );
        }
      }
      return codeValue !== null ? codeValue : data;
    }

    return data;
  };

  exports.generateColumnsFromFields = function(fields, typeIdField, types, supportsOrder) {
    var columns = {};
    array.forEach(fields, lang.hitch(exports, function(_field, i) {
      var techFieldName = "field" + i;
      var isDomain = !!_field.domain;
      var isDate = _field.type === "esriFieldTypeDate";
      var isTypeIdField = typeIdField && (_field.name === typeIdField);
      columns[techFieldName] = {
        label: _field.alias || _field.name,
        className: techFieldName,
        hidden: !_field.show && esriLang.isDefined(_field.show),
        unhidable: !_field.show && esriLang.isDefined(_field.show) && _field._pk,
        field: _field.name
      };

      columns[techFieldName].sortable = !!supportsOrder;

      if (fields[i].type === "esriFieldTypeString") {
        columns[techFieldName].formatter = lang.hitch(exports, exports.urlFormatter);
      } else if (fields[i].type === "esriFieldTypeDate") {
        columns[techFieldName].formatter = lang.hitch(exports, exports.dateFormatter);
      } else if (fields[i].type === "esriFieldTypeDouble" ||
        fields[i].type === "esriFieldTypeSingle" ||
        fields[i].type === "esriFieldTypeInteger" ||
        fields[i].type === "esriFieldTypeSmallInteger") {
        columns[techFieldName].formatter = lang.hitch(exports, exports.numberFormatter);
      }

      if (isDomain) {
        columns[techFieldName].get = lang.hitch(exports, function(field, obj) {
          return this.getCodeValue(field.domain, obj[field.name]);
        }, _field);
      } else if(isTypeIdField) {
        columns[techFieldName].get = lang.hitch(exports, function(field, types, obj) {
          return this.getTypeName(obj[field.name], types);
        }, _field, types);
      } else if (!isDomain && !isDate && !isTypeIdField) {
        // Not A Date, Domain or Type Field
        // Still need to check for codedType value
        columns[techFieldName].get = lang.hitch(exports,
          function(field, typeIdField, types, obj) {
            var codeValue = null;
            if (typeIdField && types && types.length > 0) {
              var typeCheck = array.filter(types, lang.hitch(exports, function(item) {
                // value of typeIdFild has been changed above
                return item.name === obj[typeIdField];
              }));

              if (typeCheck && typeCheck.domains &&
                typeCheck.domains[field.name] && typeCheck.domains[field.name].codedValues) {
                codeValue = this.getCodeValue(
                  typeCheck.domains[field.name],
                  obj[field.name]
                );
              }
            }
            var _value = codeValue !== null ? codeValue : obj[field.name];
            return _value || isFinite(_value) ? _value : "";
          }, _field, typeIdField, types);
      }
    }));

    return columns;
  };

  exports.getTypeName = function(value, types) {
    var len = types.length;
    for (var i = 0; i < len; i++) {
      if (value === types[i].id) {
        return types[i].name;
      }
    }
    return value;
  };

  exports.getCodeValue = function(domain, v) {
    if (domain.codedValues) {
      for (var i = 0, len = domain.codedValues.length; i < len; i++) {
        var cv = domain.codedValues[i];
        if (v === cv.code) {
          return cv.name;
        }
      }
      return v;
    } else {
      return v || null;
    }
  };

  exports.urlFormatter = function(str) {
    if (str && typeof str === "string") {
      var s = str.indexOf('http:');
      if (s === -1) {
        s = str.indexOf('https:');
      }
      if (s > -1) {
        if (str.indexOf('href=') === -1) {
          var e = str.indexOf(' ', s);
          if (e === -1) {
            e = str.length;
          }
          var link = str.substring(s, e);
          str = str.substring(0, s) +
            '<A href="' + link + '" target="_blank">' + link + '</A>' +
            str.substring(e, str.length);
        }
      }
    }
    return str || "";
  };

  exports.dateFormatter = function(str) {
    if (str) {
      var sDateate = new Date(str);
      str = utils.localizeDate(sDateate, {
        fullYear: true
      });
    }
    return str || "";
  };

  exports.numberFormatter = function(num) {
    if (typeof num === 'number') {
      var decimalStr = num.toString().split('.')[1] || "",
        decimalLen = decimalStr.length;
      num = utils.localizeNumber(num, {
        places: decimalLen
      });
      return '<span class="jimu-numeric-value">' + (num || "") + '</span>';
    }
    return num;
  };

  exports.readLayerObjectsFromMap = function(map) {
    var def = new Deferred(),
      defs = [];
    this.readLayerInfosFromMap(map).then(lang.hitch(this, function(layerInfos) {
      array.forEach(layerInfos, lang.hitch(this, function(layerInfo) {
        defs.push(layerInfo.getLayerObject());
      }));

      all(defs).then(lang.hitch(this, function(layerObjects) {
        def.resolve(layerObjects);
      }), lang.hitch(this, function(err) {
        def.reject(err);
        console.error(err);
      }));
    }), lang.hitch(this, function(err) {
      def.reject(err);
    }));

    return def.promise;
  };

  exports.readSupportTableInfoFromLayerInfos = function(layerInfos) {
    var def = new Deferred();
    var defs = [];
    array.forEach(layerInfos, lang.hitch(this, function(layerInfo) {
      defs.push(layerInfo.getSupportTableInfo());
    }));

    all(defs).then(lang.hitch(this, function(tableInfos) {
      var _tInfos = lang.clone(tableInfos);
      array.forEach(_tInfos, function(tInfo, idx) {
        tInfo.id = layerInfos[idx].id;
      });
      def.resolve(_tInfos);
    }), function(err) {
      def.reject(err);
    });

    return def.promise;
  };

  exports.readConfigLayerInfosFromMap = function(map) {
    var def = new Deferred(),
      defs = [];
    this.readLayerInfosFromMap(map).then(lang.hitch(this, function(layerInfos) {
      var ret = [];
      array.forEach(layerInfos, function(layerInfo) {
        defs.push(layerInfo.getSupportTableInfo());
      });

      all(defs).then(lang.hitch(this, function(tableInfos) {
        array.forEach(tableInfos, lang.hitch(this, function(tableInfo, i) {
          if (tableInfo.isSupportedLayer) {
            layerInfos[i].name = layerInfos[i].title;
            ret.push(layerInfos[i]);
          }
        }));
        fixDuplicateNames(ret);

        def.resolve(ret);
      }), lang.hitch(this, function(err) {
        def.reject(err);
      }));
    }), lang.hitch(this, function(err) {
      def.reject(err);
    }));

    return def.promise;
  };

  exports.getConfigInfosFromLayerInfos = function(layerInfos) {
    return array.map(layerInfos, function(layerInfo) {
      return exports.getConfigInfoFromLayerInfo(layerInfo);
    });
  };

  exports.getConfigInfoFromLayerInfo = function(layerInfo) {
    var json = {};
    json.name = layerInfo.name || layerInfo.title;
    json.id = layerInfo.id;
    json.show = layerInfo.isShowInMap();
    json.layer = {
      url: layerInfo.getUrl()
    };

    var popupInfo = layerInfo.getPopupInfo();
    if (popupInfo && !popupInfo.description) {
      json.layer.fields = array.map(popupInfo.fieldInfos, function(fieldInfo) {
        return {
          name: fieldInfo.fieldName,
          alias: fieldInfo.label.toLowerCase(),
          show: fieldInfo.visible
        };
      });
    }

    return json;
  };

  exports.generateCacheStore = function(_layer, recordCounts, batchCount, whereClause) {
    var qtStore = new FeatureLayerQueryStore({
      layer: _layer,
      objectIds: _layer._objectIds || null,
      totalCount: recordCounts,
      batchCount: batchCount,
      where: whereClause || "1=1"
    });

    var mStore = new Memory();
    return (new Cache(qtStore, mStore, {}));
  };

  exports.generateMemoryStore = function(data, idProperty) {
    return (new Observable(new Memory({
      "data": data || [],
      "idProperty": idProperty
    })));
  };

  function fixDuplicateNames(layerObjects) {
    var titles = [],
      duplicateLayers = [];
    array.forEach(layerObjects, function(layerObject) {
      var pos = titles.indexOf(layerObject.name);
      if (pos < 0) {
        titles.push(layerObject.name);
      } else {
        duplicateLayers.push(layerObjects[pos]);
        duplicateLayers.push(layerObject);
      }
    });
    array.forEach(duplicateLayers, function(layerObject) {
      layerObject.name = layerObject.name + '-' + layerObject.id;
    });
  }
});