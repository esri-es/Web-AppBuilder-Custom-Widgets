///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2017 Esri. All Rights Reserved.
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
  'dojo/_base/array',
  'dojo/_base/lang',
  'dojo/_base/config',
  './_dateFormat',
  'moment/moment',
  'jimu/utils',
  'esri/lang'
], function(declare, array, lang, config, dateFormat, moment, jimuUtils, esriLang) {

  window.makeTwix(moment);

  var Core = declare(null, {
    popupFieldInfosObj: null,//{fieldName:{fieldName,label,isEditable,tooltip,visible,format...}}

    //option
    //layerDefinition
    //popupFieldInfosObj
    //floatNumberFieldDecimalPlace

    constructor: function(options) {
      if (options) {
        lang.mixin(this, options);
      }
      if(!this.popupFieldInfosObj){
        this.popupFieldInfosObj = {};
      }
      this.floatNumberFieldDecimalPlace = {};
    },

    _isNumber: function(value) {
      var valueType = Object.prototype.toString.call(value).toLowerCase();
      return valueType === "[object number]";
    },

    _tryLocaleNumber: function(value, /*optional*/ fieldName) {
      var result = value;
      if (esriLang.isDefined(value) && isFinite(value)) {
        try {
          var a;
          //if pass "abc" into localizeNumber, it will return null
          if (fieldName && this._isNumberField(fieldName)) {
            var popupFieldInfo = this.popupFieldInfosObj[fieldName];
            if (popupFieldInfo && lang.exists('format.places', popupFieldInfo)) {
              a = jimuUtils.localizeNumberByFieldInfo(value, popupFieldInfo);
            } else {
              a = jimuUtils.localizeNumber(value);
            }
          } else {
            //#6117
            a = value; //jimuUtils.localizeNumber(value);
          }

          if (typeof a === "string") {
            result = a;
          }
        } catch (e) {
          console.error(e);
        }
      }
      //make sure the retun value is string
      result += "";
      return result;
    },

    _getBestDisplayValue:function(fieldName, fieldValue){
      if(!fieldValue && typeof fieldValue !== 'number'){
        return 'null';
      }
      if(this._isDateField(fieldName)){
        //handle date
        return this._dateFormatter(fieldName, fieldValue);
      }else{
        //handle number, sub type and coded value
        return this._valueFormatter(fieldName, fieldValue);
      }
    },

    _dateFormatter:function(fieldName, fieldValue){

      function getFormatInfo(fieldName) {
        if (this.popupFieldInfosObj && esriLang.isDefined(this.popupFieldInfosObj.fieldInfos)) {
          for (var i = 0, len = this.popupFieldInfosObj.fieldInfos.length; i < len; i++) {
            var f = this.popupFieldInfosObj.fieldInfos[i];
            if (f.fieldName === fieldName) {
              return f.format;
            }
          }
        }
        return null;
      }
      var format = getFormatInfo.call(this,fieldName);
      return jimuUtils.fieldFormatter.getFormattedDate(fieldValue, format);
    },

    _valueFormatter: function(fieldName, value) {
      var displayValue = this._tryLocaleNumber(value, fieldName);
      //check subtype description
      //http://services1.arcgis.com/oC086ufSSQ6Avnw2/arcgis/rest/services/Parcels/FeatureServer/0
      if (this.layerDefinition.typeIdField === fieldName) {
        var types = this.layerDefinition.types;
        if (types && types.length > 0) {
          var typeObjs = array.filter(types, lang.hitch(this, function(item) {
            return item.id === value;
          }));
          if (typeObjs.length > 0) {
            displayValue = typeObjs[0].name;
            return displayValue;
          }
        }
      }

      //check codedValue
      //http://jonq/arcgis/rest/services/BugFolder/BUG_000087622_CodedValue/FeatureServer/0
      //http://services1.arcgis.com/oC086ufSSQ6Avnw2/arcgis/rest/services/Parcels/FeatureServer/0
      var fieldInfo = this._getFieldInfo(fieldName);
      if (fieldInfo) {
        if (fieldInfo.domain) {
          var codedValues = fieldInfo.domain.codedValues;
          if (codedValues && codedValues.length > 0) {
            array.some(codedValues, function(item) {
              if (item.code === value) {
                displayValue = item.name;
                return true;
              } else {
                return false;
              }
            });
          }
        }
      }
      return displayValue;
    },

    _getFieldAliasArray: function(fieldNames) {
      var results = array.map(fieldNames, lang.hitch(this, function(fieldName) {
        return this._getFieldAlias(fieldName);
      }));
      return results;
    },

    _getFieldAlias: function(fieldName) {
      var fieldAlias = fieldName;
      var fieldInfo = this._getFieldInfo(fieldName);
      if (fieldInfo) {
        fieldAlias = fieldInfo.alias || fieldAlias;
      }
      return fieldAlias;
    },

    _getFieldInfo: function(fieldName) {
      if (this.layerDefinition) {
        var fieldInfos = this.layerDefinition.fields;
        for (var i = 0; i < fieldInfos.length; i++) {
          if (fieldInfos[i].name === fieldName) {
            return fieldInfos[i];
          }
        }
      }
      return null;
    },

    _isNumberField: function(fieldName) {
      var numberTypes = ['esriFieldTypeSmallInteger',
        'esriFieldTypeInteger',
        'esriFieldTypeSingle',
        'esriFieldTypeDouble'
      ];
      var isNumber = array.some(this.layerDefinition.fields, lang.hitch(this, function(fieldInfo) {
        return fieldInfo.name === fieldName && numberTypes.indexOf(fieldInfo.type) >= 0;
      }));
      return isNumber;
    },

    _isFloatNumberField: function(fieldName) {
      var numberTypes = ['esriFieldTypeSingle', 'esriFieldTypeDouble'];
      var isNumber = array.some(this.layerDefinition.fields, lang.hitch(this, function(fieldInfo) {
        return fieldInfo.name === fieldName && numberTypes.indexOf(fieldInfo.type) >= 0;
      }));
      return isNumber;
    },

    _isDateField: function(fieldName) {
      var fieldInfo = this._getFieldInfo(fieldName);
      if (fieldInfo) {
        return fieldInfo.type === 'esriFieldTypeDate';
      }
      return false;
    },

    _getBestDecimalPlace: function(floatValues) {
      var decimalPlace = 0;
      //{decimal:count,...} like {2:123, 3:321, ...}
      var statisticsHash = {};
      array.forEach(floatValues, function(value) {
        var splits = value.toString().split(".");
        var key = null;
        if (splits.length === 1) {
          //value doesn't have fractional part
          key = 0;
        } else if (splits.length === 2) {
          //value has fractional part
          key = splits[1].length;
        }
        if (key !== null) {
          if (statisticsHash[key] === undefined) {
            statisticsHash[key] = 1;
          } else {
            statisticsHash[key] += 1;
          }
        }
      });
      var maxDecimalPlaceItem = null;
      for (var key in statisticsHash) {
        key = parseInt(key, 10);
        var value = statisticsHash[key];
        if (maxDecimalPlaceItem) {
          if (value > maxDecimalPlaceItem.value) {
            maxDecimalPlaceItem = {
              key: key,
              value: value
            };
          }
        } else {
          maxDecimalPlaceItem = {
            key: key,
            value: value
          };
        }
      }
      if (maxDecimalPlaceItem) {
        decimalPlace = parseInt(maxDecimalPlaceItem.key, 10);
      }
      return decimalPlace;
    },

    _getFloatNumberFieldDecimalPlace: function(floatNumberField) {
      var decimalPlace = 0;
      if (this.floatNumberFieldDecimalPlace) {
        var value = this.floatNumberFieldDecimalPlace[floatNumberField];
        if (typeof value === 'number') {
          decimalPlace = value;
        }
      }
      return decimalPlace;
    },

    _getBestValueForFloatNumberField: function(value, floatNumberField) {
      if(value === null){
        return value;
      }
      var decimalPlace = this._getFloatNumberFieldDecimalPlace(floatNumberField);
      var str = value.toFixed(decimalPlace);
      return parseFloat(str);
    },

    _convertToEchartsRbga:function(symbolColor){
      if(!symbolColor || typeof symbolColor.r === 'undefined'){
        return symbolColor;
      }
      symbolColor = JSON.parse(JSON.stringify(symbolColor));
      var color = 'rgba(';
      color += symbolColor.r + ',';
      color += symbolColor.g + ',';
      color += symbolColor.b + ',';
      color += symbolColor.a + ')';
      return color;
    },

    _addColorToChartData:function(mode, featureLayer, features, data){
      if(mode === 'feature'){
        return this. _addColorToFeatruesForFeatureMode(featureLayer, features);
      }else{
        if(mode !== 'category' && mode !== 'count'){
          return data;
        }
        //add color to data
        return this._addColorToDataForCategoryCountMode(featureLayer, data);
      }
    },

    _addColorToDataForCategoryCountMode:function(featureLayer, data){
      var renderer = featureLayer.renderer;
      data = data.map(function(item){
        var feature = item.dataFeatures[0];
        if(!feature){
          item.color = false;
        }else{
          var colorObj = this._getCategoryColor(renderer, feature);
          feature = null;
          if(typeof colorObj.color !== 'undefined'){
            item.color = colorObj.color;
          }
        }
        return item;
      }.bind(this));
      return data;
    },

    _getVisualVariableByType: function(type, visualVariables) {
      // we could also use esri.renderer.Renderer.getVisualVariablesForType for renderers

      if (visualVariables) {
        var visVars = array.filter(visualVariables, function (visVar) {
          return (visVar.type === type && !visVar.target);
        });
        if (visVars.length) {
          return visVars[0];
        } else {
          return null;
        }
      }
      return null;
    },

    _getCategoryColor:function(renderer, feature){
      var symbol = null;
      var colorObj = {};

      symbol = this._getSymbolByRenderer(renderer, feature);

      colorObj = this._getColorFromSymbol(colorObj, symbol);

      symbol = null;
      return colorObj;
    },
    _getSymbolByRenderer:function(renderer, feature){
      var symbol = null;
      var visualVariables = renderer.visualVariables;
      var visVar = this._getVisualVariableByType('colorInfo', visualVariables);
      if(visVar){
        var color = renderer.getColor(feature, {
          colorInfo: visVar
        });
        if(color){
          color = this._convertToEchartsRbga(color);
          symbol = {
            color:color
          };
        }
      }else{
        symbol = renderer.getSymbol(feature);
      }

      if(!symbol){
        symbol = {
          color:false
        };
      }
      return symbol;
    },
    _getColorFromSymbol:function(colorObj, symbol){
      if(symbol && typeof symbol.color !== 'undefined'){
        colorObj.color = this._convertToEchartsRbga(symbol.color);
      }
      return colorObj;
    },
    _addColorToFeatruesForFeatureMode:function(featureLayer, features){
      if(!featureLayer || !Array.isArray(features)) {
        return features;
      }
      var renderer = featureLayer.renderer;

      features.forEach(function(f){
        //get symbol
        var symbol = null, colorObj = {};
        if(f.symbol && f.symbol.color){
          symbol = f.symbol;
        }else if(renderer){
          symbol = this._getSymbolByRenderer(renderer, f);
        }

        colorObj = this._getColorFromSymbol(colorObj, symbol);
        if(typeof colorObj.color !== 'undefined'){
          f.color = colorObj.color;
        }
        return f;
      }.bind(this));
      return features;
    },

    //---------------------------------------feature mode--------------------------------------------

    //options: {features, labelField, valueFields, sortOrder}
    //return [{category:'a',valueFields:[10,100,2],dataFeatures:[f1]}]
    getFeatureModeStatisticsInfo: function(options) {
      var features = options.features;
      var labelField = options.labelField;
      var valueFields = options.valueFields;
      var sortOrder = options.sortOrder;//{isAsc:boolean,field:''}
      var maxLabels = options.maxLabels;//number or undefined
      var featureLayerForChartSymbologyChart = options.featureLayerForChartSymbologyChart;
      var useLayerSymbology = options.useLayerSymbology;

      var showNullLabelData = true;
      var nullLabelFeatures = [];
      var notNullLabelFeatures = features.filter(function(feature){
        var attributes = feature.attributes;
        var fieldValue = attributes[labelField];
        if(!fieldValue && typeof fieldValue !== 'number'){
          nullLabelFeatures.push(feature);
        }else {
          return true;
        }
      });

      features = showNullLabelData?notNullLabelFeatures.concat(nullLabelFeatures):notNullLabelFeatures;

      if(useLayerSymbology){
        features = this._addColorToChartData('feature', featureLayerForChartSymbologyChart, features);
      }
      //sort the features by a field value in features
      features =  this._sortStatisticsInfo(features, 'feature', sortOrder, labelField);

      //[{category:'a',valueFields:[10,100,2],dataFeatures:[f1]}]only one data feature
      var data = [];

      data = array.map(features, lang.hitch(this, function(feature) {
        var attributes = feature.attributes;
        var option = {
          category: attributes[labelField],
          valueFields: [],
          dataFeatures: [feature]
        };
        //color and border color
        if(typeof feature.color !== 'undefined'){
          option.color = feature.color;
          feature.color = undefined;
        }
        option.valueFields = array.map(valueFields, lang.hitch(this, function(fieldName) {
          return attributes[fieldName];
        }));
        return option;
      }));
      if (data.length > 0) {
        data.forEach(lang.hitch(this, function(item) {
          var category = item.category;
          item.category = this._getBestDisplayValue(labelField, category);
        }));
      }
      //max labels
      return this._getDataForMaxLabels(data, maxLabels);
    },
    //---------------------------------------category mode-----------------------------------------
    //options: {features, categoryField, valueFields, operation, sortOrder, dateConfig/*optional*/}
    //return [{category:'a',valueFields:[10,100,2],dataFeatures:[f1,f2...],
    //fieldsValues:{label,value}(for value axis sort), originValue:''}(for label axis sort)]
    getCategoryModeStatisticsInfo: function(options) {
      /*jshint -W083 */
      var features = options.features;
      var categoryField = options.categoryField;
      var valueFields = options.valueFields;
      var operation = options.operation;
      var sortOrder = options.sortOrder;//{isLabelAxis:boolean/*optional*/,isAsc:boolean,field:''}
      //dateConfig:{isNeedFilled:boolean,dateFormatter:''//automatic, year, month, day, hour, minute, second}
      var dateConfig = options.dateConfig;
      var maxLabels = options.maxLabels;//number or undefined
      var useNullValueAsZero = options.nullValue;//boolean
      var showNullLabelData = true;
      //useLayerSymbology
      var featureLayerForChartSymbologyChart = options.featureLayerForChartSymbologyChart;
      var useLayerSymbology = options.useLayerSymbology;

      var data = []; //[{category:'a',valueFields:[10,100,2],dataFeatures:[f1,f2...]},...]
      //{a:{valueFields:[10,100,2], dataFeatures:[f1,f2...]}}
      var hashObj = this.getCategoryOrCountHashObj(categoryField, features, dateConfig);
      var notNullLabelHashObj = hashObj.notNullLabelHashObj;
      var nullLabelHashObj = hashObj.nullLabelHashObj;

      var notNullLabelClusteredData = clusterByLbabel.call(this, notNullLabelHashObj);
      var nullLabelClusteredData = clusterByLbabel.call(this, nullLabelHashObj);

      data = showNullLabelData?notNullLabelClusteredData.concat(nullLabelClusteredData):notNullLabelClusteredData;
      //return [{category:'a',valueFields:[10,100,2],dataFeatures:[f1,f2...]},...]
      function clusterByLbabel(hashObj){
        var data = [];
        var categoryObj = null;
        for (var uniqueValue in hashObj) {
          categoryObj = hashObj[uniqueValue];

          if (this._isNumberField(categoryField) && typeof uniqueValue === 'number') {
            //uniqueValue maybe string or null, like "7", null
            //so we should not call this._isNumber(uniqueValue)
            if (esriLang.isDefined(uniqueValue)) {
              //convert number string to number
              uniqueValue = parseFloat(uniqueValue);
            }
          }

          //calculate summarize values for one category
          categoryObj.fieldsValues = array.map(valueFields, lang.hitch(this, function(fieldName) {
            //for one category and for one valueField
            var values = array.map(categoryObj.dataFeatures, lang.hitch(this, function(feature) {
              return feature.attributes[fieldName];
            }));
            var summarizeValue;
            if(values.length !== 0){
              summarizeValue = 0;
              if (operation === 'max') {
                summarizeValue = -Infinity;
              } else if (operation === 'min') {
                summarizeValue = Infinity;
              }

              //handle null value
              if(useNullValueAsZero){
                values = values.map(function(val){
                  if(!this._isNumber(val)){
                    val = 0;
                  }
                  return val;
                }.bind(this));
              }else{
                values = values.filter(function(val){
                  return this._isNumber(val);
                }.bind(this));
              }
              //use nonNullValueCount to record how many feature values are not null for the fieldName
              var count = 0;
              array.forEach(values, lang.hitch(this, function(value) {
                count++;
                if (operation === 'average' || operation === 'sum') {
                  summarizeValue += value;
                } else if (operation === 'max') {
                  summarizeValue = Math.max(summarizeValue, value);
                } else if (operation === 'min') {
                  summarizeValue = Math.min(summarizeValue, value);
                }
              }));

              if (count > 0) {
                if (operation === 'average') {
                  //summarizeValue = summarizeValue / values.length;
                  summarizeValue = summarizeValue / count;
                }
              } else {
                //if all values for the fieldName are null, we set summarizeValue to null, no matter
                //what's the value of operation
                summarizeValue = null;
              }
            }else{
              summarizeValue = null;
            }

            return {
              field: fieldName,
              value: summarizeValue
            };
          }));
          categoryObj.valueFields = array.map(categoryObj.fieldsValues, function(fieldsValue) {
            return fieldsValue.value;
          });
          data.push({
            originValue: categoryObj.originValue,
            category: uniqueValue,
            valueFields: categoryObj.valueFields,
            fieldsValues: categoryObj.fieldsValues,
            dataFeatures: categoryObj.dataFeatures
          });
        }
        return data;
      }
      //order
      data = this._sortStatisticsInfo(data, 'category', sortOrder);
      //remove NaN item
      data = array.filter(data, lang.hitch(this, function(item) {
        var isNaNValue = false;
        var category = item.category;
        if (typeof category === 'number') {
          isNaNValue = isNaN(category);
        }
        return !isNaNValue;
      }));

      //keep best decimal places for statistics values
      if (operation === 'sum' || operation === 'average') {
        array.forEach(data, lang.hitch(this, function(item) {
          array.forEach(valueFields, lang.hitch(this, function(fieldName, index) {
            if (this._isFloatNumberField(fieldName)) {
              var value = item.valueFields[index];
              value = this._getBestValueForFloatNumberField(value, fieldName);
              item.valueFields[index] = value;
            }
          }));
        }));
      }
      //max labels
      data = this._getDataForMaxLabels(data, maxLabels);
      //add feature's symbol's color to data
      if(useLayerSymbology){
        data = this._addColorToChartData('category', featureLayerForChartSymbologyChart,
        features, data);
      }
      return data;
    },

    //---------------------------------------count mode--------------------------------------------
    //options: {features, categoryField, sortOrder}
    //return [{fieldValue:value1,count:count1,dataFeatures:[f1,f2...]}]
    getCountModeStatisticsInfo: function(options) {
      var features = options.features;
      var categoryField = options.categoryField;
      var sortOrder = options.sortOrder;//{isLabelAxis:boolean/*optional*/,isAsc:boolean,field:''}
      //dateConfig:{isNeedFilled:boolean,dateFormatter:''//automatic, year, month, day, hour, minute, second}
      var dateConfig = options.dateConfig;
      var maxLabels = options.maxLabels;//number or undefined
      var showNullLabelData = true;
      //useLayerSymbology
      var featureLayerForChartSymbologyChart = options.featureLayerForChartSymbologyChart;
      var useLayerSymbology = options.useLayerSymbology;
      var data = []; //[{fieldValue:value1,count:count1,dataFeatures:[f1,f2...]}]
      //{fieldValue1:{count:count1,dataFeatures:[f1,f2...]},fieldValue2...}
      var hashObj = this.getCategoryOrCountHashObj(categoryField, features, dateConfig);
      var notNullLabelHashObj = hashObj.notNullLabelHashObj;
      var nullLabelHashObj = hashObj.nullLabelHashObj;

      var notNullLabelClusteredData = clusterByLbabel.call(this, notNullLabelHashObj);
      var nullLabelClusteredData = clusterByLbabel.call(this, nullLabelHashObj);
      data = showNullLabelData?notNullLabelClusteredData.concat(nullLabelClusteredData):notNullLabelClusteredData;
      //return [{category:'a',valueFields:[10,100,2],dataFeatures:[f1,f2...]},...]
      function clusterByLbabel(hashObj){
        var data = [];
        var fieldValueObj = null;
        for (var fieldValue in hashObj) {
          fieldValueObj = hashObj[fieldValue]; //{count:count1,dataFeatures:[f1,f2...]}
          if (this._isNumberField(categoryField) && typeof fieldValue === 'number') {
            //fieldValue maybe string or null, like "7", "null"
            //convert number string to number
            //if fieldValue is "null", fieldValue will be set to NaN
            fieldValue = parseFloat(fieldValue);
          }
          data.push({
            originValue: fieldValueObj.originValue,
            fieldValue: fieldValue,
            count: fieldValueObj.count,
            dataFeatures: fieldValueObj.dataFeatures
          });
        }
        return data;
      }
      //sort
      data = this._sortStatisticsInfo(data, 'count', sortOrder);
      //max labels
      data = this._getDataForMaxLabels(data, maxLabels);
      //add feature's symbol's color to data
      if(useLayerSymbology){
        data = this._addColorToChartData('count', featureLayerForChartSymbologyChart,
        features, data);
      }
      return data;
    },

    //---------------------------------------field mode--------------------------------------------

    //options: {features, valueFields, operation}
    //return data: [{label:fieldName,value:,fieldValue}]
    getFieldModeStatisticsInfo: function(options) {
      var features = options.features;
      var valueFields = options.valueFields;
      var operation = options.operation;
      var sortOrder = options.sortOrder;//{isLabelAxis:boolean/*optional*/,isAsc:boolean,field:''}
      var maxLabels = options.maxLabels;//number or undefined
      var useNullValueAsZero = options.nullValue;//boolean

      //[feature.attributes]
      var attributesList = array.map(features, lang.hitch(this, function(feature) {
        return feature.attributes;
      }));

      var data = {};

      array.forEach(valueFields, lang.hitch(this, function(fieldName) {
        //init default statistics value
        data[fieldName] = 0;
        if (operation === 'max') {
          data[fieldName] = -Infinity;
        } else if (operation === 'min') {
          data[fieldName] = Infinity;
        }
        var values = attributesList.map(function(attributes){
          return attributes[fieldName];
        });
        var count = 0;
        //handle null value
        if(useNullValueAsZero){
          values = values.map(function(val){
            if(!this._isNumber(val)){
              val = 0;
            }
            return val;
          }.bind(this));
        }else{
          values = values.filter(function(val){
            return this._isNumber(val);
          }.bind(this));
        }

        array.forEach(values, lang.hitch(this, function(fieldValue) {
          count++;
          if (data.hasOwnProperty(fieldName)) {
            if (operation === 'average' || operation === 'sum') {
              data[fieldName] += fieldValue;
            } else if (operation === 'max') {
              data[fieldName] = Math.max(data[fieldName], fieldValue);
            } else if (operation === 'min') {
              data[fieldName] = Math.min(data[fieldName], fieldValue);
            }
          } else {
            data[fieldName] = fieldValue;
          }
        }));

        if (count > 0) {
          if (operation === 'average') {
            //data[fieldName] /= attributesList.length;
            data[fieldName] = data[fieldName] / count;
          }
        } else {
          data[fieldName] = null;
        }
      }));

      //keep best decimal places for statistics values
      if (operation === 'sum' || operation === 'average') {
        array.forEach(valueFields, lang.hitch(this, function(fieldName) {
          if (data.hasOwnProperty(fieldName) && this._isFloatNumberField(fieldName)) {
            var value = data[fieldName];
            data[fieldName] = this._getBestValueForFloatNumberField(value, fieldName);
          }
        }));
      }
      var arrayData = [];
      for (var label in data) {
        if(data.hasOwnProperty(label)){
          arrayData.push({
            label: label,
            value: data[label]
          });
        }
      }
      //[{label:fieldName,value:,fieldValue}]
      arrayData = this._sortStatisticsInfo(arrayData, 'field', sortOrder);
      //max labels
      return this._getDataForMaxLabels(arrayData, maxLabels);
    },

    _getDataForMaxLabels: function(data, maxLabels){
      if(typeof maxLabels === 'number' && maxLabels >= 0 && maxLabels < data.length){
        return data.slice(0, maxLabels);
      }else{
        return data;
      }
    },
    //return sorted data
    _sortStatisticsInfo: function(data, mode, sortOrder, labelField) {
      //sortOrder
      //  isLabelAxis:boolean
      //  isAsc:boolean
      //  field:''

      if(!sortOrder){
        return data;
      }

      var isAsc = sortOrder.isAsc;

      function getVaildValue(obj, mode, sortOrder) {
        var value;
        if (mode === 'category') {
          if (!sortOrder.isLabelAxis) {
            if (!sortOrder.field && obj.fieldsValues.length === 1) {
              value = obj.fieldsValues[0].value;
            } else {
              obj.fieldsValues.forEach(function(fieldValue) {
                if (sortOrder.field === fieldValue.field) {
                  value = fieldValue.value;
                }
              });
            }
          } else if (sortOrder.isLabelAxis) {
            value = obj.originValue;
          }
        } else if (mode === 'count') {
          var xValue = obj.originValue;
          value = sortOrder.isLabelAxis ? xValue : obj.count;
        } else if (mode === 'field') {
          value = sortOrder.isLabelAxis ? obj.label : obj.value;
        }else if(mode === 'feature'){
          if(sortOrder.isLabelAxis){
            value = obj.attributes[labelField];
          }else{
            value = obj.attributes[sortOrder.field];
          }
        }
        return value;
      }

      if (!Array.isArray(data)) {
        return data;
      }

      data.sort(function(a, b) {
        var aValue = getVaildValue(a, mode, sortOrder);
        var bValue = getVaildValue(b, mode, sortOrder);
        if(!aValue && typeof aValue !== 'number'){
          aValue = Infinity;
        }
        if(!bValue && typeof bValue !== 'number'){
          bValue = Infinity;
        }
        var sortvalue = 0;
        var sortBoolean = aValue > bValue ? isAsc : !isAsc;
        sortvalue = sortBoolean ? 1 : -1;
        if (aValue === bValue) {
          sortvalue = 0;
        }
        return sortvalue;
      });

      return data;
    },
    //return year...second
    _getDateUnit: function(range, dateFormatter){
      var dateUnit = dateFormatter;
      if(dateFormatter === 'automatic'){
        var start = moment(range[0]).local();
        var end = moment(range[1]).local();
        var minutes = Math.round(end.diff(start, 'minute', true));
        if(minutes >= 0 && minutes <= 1){
          dateUnit = 'second';
        }else if(minutes > 1 && minutes <= 60){
          dateUnit = 'minute';
        }else if(minutes > 60 && minutes <= 60 * 24){
          dateUnit = 'hour';
        }else if(minutes > 60 * 24 && minutes <= 60 * 24 * 30){
          dateUnit = 'day';
        }else if(minutes > 60 * 24 * 30 && minutes <= 60 * 24 * 30 * 12){
          dateUnit = 'month';
        }else if(minutes > 60 * 24 * 30 * 12){
          dateUnit = 'year';
        }
      }
      return dateUnit;
    },
    //return [minTime, maxTime]
    _getTimeRange: function(features, fieldName){

      var times = features.map(lang.hitch(this, function(feature) {
        var attributes = feature.attributes;
        return attributes[fieldName];
      }));
      times = times.filter(function(e) {
        return !!e;
      });

      var minTime = Math.min.apply(Math, times);
      var maxTime = Math.max.apply(Math, times);
      return [minTime, maxTime];
    },
    //return {twixs:[], dateUnit:'year...second'}
    _getTimeTwixs: function(features, fieldName, dateFormatter) {
      var formats = ['year', 'month', 'day', 'hour', 'minute', 'second', 'automatic'];
      if (formats.indexOf(dateFormatter) < 0) {
        console.log('Invaild data formatter: ' + dateFormatter);
        return false;
      }
      var range = this._getTimeRange(features, fieldName);
      //all time is same
      if(range[0] === range[1]){
        return false;
      }
      var dateUnit = this._getDateUnit(range, dateFormatter);
      //example: dateUnit = month, range[0] = 2/8/2000 08:20:20,
      //return startTime = 1/8/2000 00:00:00,
      var startTime = this._getIntegerDateByUnit(range[0], dateUnit);

      var start = moment(startTime).local();
      var end = moment(range[1]).local();

      var tw = start.twix(end);
      var twixs = tw.split(1, dateUnit);
      var twixEndValue = twixs[twixs.length - 1].end().valueOf();
      var lastTwix = {
        startValue:twixEndValue,
        endValue:Infinity
      };
      twixs.push(lastTwix);
      return {
        twixs: twixs,
        dateUnit: dateUnit
      };
    },

    _getIntegerDateByUnit:function(time, unit){
      var momentTime = moment(time);
      var integerDate,
      year =  momentTime.year(),
      month = momentTime.month(),
      day = momentTime.date(),
      hour = momentTime.hour(),
      minute = momentTime.minute(),
      second = momentTime.second();

      switch (unit) {
        case 'year':
          integerDate = moment({year:year}).valueOf();
        break;
        case 'month':
          integerDate = moment({year:year, month:month}).valueOf();
        break;
        case 'day':
          integerDate = moment({year:year, month:month, day:day}).valueOf();
        break;
        case 'hour':
          integerDate = moment({year:year, month:month, day:day, hour:hour}).valueOf();
        break;
        case 'minute':
          integerDate = moment({year:year, month:month, day:day, hour:hour, minute: minute}).valueOf();
        break;
        case 'second':
          integerDate = moment({year:year, month:month, day:day, hour:hour, minute: minute, second:second}).valueOf();
        break;
        default:
          integerDate = time;
        break;
      }

      return integerDate;
    },
    _getDateCategory: function(fieldValue, dateFormatter){

      if(!dateFormatter){
        return fieldValue;
      }
      return this._getFormatteredDate(fieldValue, dateFormatter);
    },
    //return formattered date or date and time
    _getFormatteredDate: function(time, dateFormatter){
      var timePattern = this._getDateTemplate(dateFormatter);
      var dateTime, date, times;
      if(['year', 'month', 'day'].indexOf(dateFormatter) >= 0){
        dateTime = jimuUtils.localizeDate(new Date(time),{selector:'date', datePattern : timePattern.date});
      }else{
        date = jimuUtils.localizeDate(new Date(time),{selector:'date', datePattern : timePattern.date});
        // times = jimuUtils.localizeDate(new Date(time),{selector:'time', datePattern : timePattern.time});
        times = moment(time).format(timePattern.time);
        dateTime = date + timePattern.connector + times;
      }
      return dateTime;
    },

    _getDateTemplate: function(dateFormatter){
      // return {
      //    date: {
      //     short: 'MMM d, y'
      //      sNoDay:'MMM, y'
      //    },
      //    time:{
      //     short:'h:mm:ss a'
      //    },
      //    connector:' , '
      // }
      var langFormat = dateFormat[config.locale];

      langFormat = langFormat || {};
      if(langFormat && !langFormat.date){
        langFormat.date = {'short':'short'};
      }

      if(langFormat && !langFormat.time){
        langFormat.time = {'medium':'HH:mm:ss a'};
      }

      if(langFormat && !langFormat.connector){
        langFormat.connector = ' ';
      }

      if(langFormat && !langFormat.sNoDay){
        langFormat.sNoDay = 'MMM, y';
      }

      var dateTemplate = {};

      if(dateFormatter === 'year'){
        dateTemplate.date = 'y';
      }else if(dateFormatter === 'month'){
        dateTemplate.date = langFormat.date.sNoDay;
      }else if(dateFormatter === 'day'){
        dateTemplate.date = langFormat.date['short'];
      }else if(dateFormatter === 'hour'){
        dateTemplate.date = langFormat.date['short'];
        dateTemplate.time = 'HH a';
        dateTemplate.connector = langFormat.connector;
      }else if(dateFormatter === 'minute'){
        dateTemplate.date = langFormat.date['short'];
        dateTemplate.time = 'HH:mm a';
        dateTemplate.connector = langFormat.connector;
      }else if(dateFormatter === 'second'){
        dateTemplate.date = langFormat.date['short'];
        dateTemplate.time = langFormat.time.medium;
        dateTemplate.connector = langFormat.connector;
      }

      return dateTemplate;
    },
    //get the categories by features(for category and count mode)
    //hashObj:{[hashlabel]:{count:0, dateFeatures:[f1,f2...],originValue:'',}}
    //return {notNullLabelHashObj:hashObj,nullLabelHashObj:hashObj}
    getCategoryOrCountHashObj: function(labelFieldName, features, dateConfig){
      var nullLabelFeatures = [];
      var notNullLabelFeatures = features.filter(function(feature){
        var attributes = feature.attributes;
        var fieldValue = attributes[labelFieldName];
        if(!fieldValue && typeof fieldValue !== 'number'){
          nullLabelFeatures.push(feature);
        }else {
          return true;
        }
      });

      var notNullLabelHashObj = {};
      var nullLabelHashObj = {};

      function getHashObjForOneLabel(features, labelFieldName, notNullLabelHashObj, dateConfig) {
        var attributes = features[0].attributes;
        var fieldValue = attributes[labelFieldName];
        var label;
        if (dateConfig.minPeriod !== 'automatic') {
          label = this._getDateCategory(fieldValue, dateConfig.minPeriod);
        } else {
          label = this._getBestDisplayValue(labelFieldName, fieldValue);
        }
        var value = {
          count: 1,
          dataFeatures: features
        };
        value.originValue = fieldValue;
        notNullLabelHashObj[label] = value;

        return notNullLabelHashObj;
      }

      function updateHashValue(notNullLabelHashObj, label, originValue, hashValue) {

        if (notNullLabelHashObj[label]) {
          var oriHashValue = notNullLabelHashObj[label];
          oriHashValue.count += hashValue.count;
          oriHashValue.dataFeatures = oriHashValue.dataFeatures.concat(hashValue.dataFeatures);
        } else {
          hashValue.originValue = originValue;
          notNullLabelHashObj[label] = hashValue;
        }
      }

      if (dateConfig) {
        if(notNullLabelFeatures.length === 1){
          notNullLabelHashObj = getHashObjForOneLabel.call(this,notNullLabelFeatures, labelFieldName,
            notNullLabelHashObj, dateConfig);
        }else if(notNullLabelFeatures.length !== 0){
          //{twixs:[], dateUnit:'year...second'}
          var twixInfo = this._getTimeTwixs(notNullLabelFeatures, labelFieldName, dateConfig.minPeriod);
          if(!twixInfo){
            notNullLabelHashObj = getHashObjForOneLabel.call(this, notNullLabelFeatures, labelFieldName,
              notNullLabelHashObj, dateConfig);
          }else{
            var twixs = twixInfo.twixs;
            var dateUnit = twixInfo.dateUnit;
            twixs.forEach(function(twix) {

              var start = typeof twix.startValue !== 'undefined' ? twix.startValue : twix.start().valueOf(),
                end = typeof twix.endValue !== 'undefined' ? twix.endValue : twix.end().valueOf();
              //Get a formatted localized label for chart x axis
              var hashLabel = this._getDateCategory(start, dateUnit);
              var hashValue = {
                count: 0,
                dataFeatures: []
              };
              array.forEach(notNullLabelFeatures, lang.hitch(this, function(feature) {
                var attributes = feature.attributes;
                var fieldValue = attributes[labelFieldName];
                if (fieldValue >= start && fieldValue < end) {
                  hashValue.dataFeatures.push(feature);
                  hashValue.count++;
                }
              }));
              if (dateConfig.isNeedFilled) {
                updateHashValue.call(this, notNullLabelHashObj, hashLabel, start, hashValue);
              } else {
                if (hashValue.count > 0) {
                  updateHashValue.call(this, notNullLabelHashObj, hashLabel, start, hashValue);
                }
              }
            }.bind(this));
          }
        }
      } else {
        notNullLabelHashObj = getHashObj.call(this, notNullLabelFeatures, labelFieldName);
      }
      nullLabelHashObj = getHashObj.call(this, nullLabelFeatures, labelFieldName);

      function getHashObj(features, labelFieldName){
        var hashObj = {};
        array.forEach(features, lang.hitch(this, function(feature) {
          var attributes = feature.attributes;
          //Get a formatted localized label for chart x axis
          var hashLabel = this._getBestDisplayValue(labelFieldName, attributes[labelFieldName]);
          var hashValue = null;

          if (hashObj.hasOwnProperty(hashLabel)) {
            hashValue = hashObj[hashLabel];
            hashValue.dataFeatures.push(feature);
            hashValue.count++;
          } else {
            hashValue = {
              count: 1,
              dataFeatures: [feature]
            };
            hashValue.originValue = attributes[labelFieldName];
            hashObj[hashLabel] = hashValue;
          }
        }));
        return hashObj;
      }
      return {
        notNullLabelHashObj:notNullLabelHashObj,
        nullLabelHashObj:nullLabelHashObj
      };
    }
  });

  var mo = {
    //options: {layerDefinition, features, labelField, valueFields, sortOrder}
    //return [{category:'a',valueFields:[10,100,2],dataFeatures:[f1]}]
    getFeatureModeStatisticsInfo: function(options){
      var core = new Core({
        layerDefinition: options.layerDefinition,
        popupFieldInfosObj: options.popupFieldInfosObj
      });
      return core.getFeatureModeStatisticsInfo(options);
    },

    //options: {layerDefinition, features, categoryField, valueFields, operation, sortOrder}
    //return [{category:'a',valueFields:[10,100,2],dataFeatures:[f1,f2...]}]
    getCategoryModeStatisticsInfo: function(options){
      var core = new Core({
        layerDefinition: options.layerDefinition,
        popupFieldInfosObj: options.popupFieldInfosObj
      });
      return core.getCategoryModeStatisticsInfo(options);
    },

    //options: {layerDefinition, features, categoryField, sortOrder}
    //return [{fieldValue:value1,count:count1,dataFeatures:[f1,f2...]}]
    getCountModeStatisticsInfo: function(options){
      var core = new Core({
        layerDefinition: options.layerDefinition,
        popupFieldInfosObj: options.popupFieldInfosObj
      });
      return core.getCountModeStatisticsInfo(options);
    },

    //options: {layerDefinition, features, valueFields, operation}
    //return {fieldName1:value1,fieldName2:value2}
    getFieldModeStatisticsInfo: function(options){
      var core = new Core({
        layerDefinition: options.layerDefinition
      });
      return core.getFieldModeStatisticsInfo(options);
    }

    // getCategoryModeChartOptionsByStatisticsInfo: function(options, data, chartType){
    //   var core = new Core({
    //     layerDefinition: options.layerDefinition
    //   });
    //   return core.getCategoryModeChartOptionsByStatisticsInfo(options, data, chartType);
    // },

    // getCountModeChartOptionsByStatisticsInfo: function(options, data, chartType){
    //   var core = new Core({
    //     layerDefinition: options.layerDefinition
    //   });
    //   return core.getCountModeChartOptionsByStatisticsInfo(options, data, chartType);
    // },

    // getFieldModeChartOptionByStatisticsInfo: function(options, data, chartType){
    //   var core = new Core({
    //     layerDefinition: options.layerDefinition
    //   });
    //   return core.getFieldModeChartOptionByStatisticsInfo(options, data, chartType);
    // }
  };

  return mo;
});