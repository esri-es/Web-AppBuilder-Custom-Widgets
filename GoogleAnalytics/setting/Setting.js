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
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidgetSetting',
    'dojo/_base/lang',
    'dojo/on',
    "dijit/form/Textarea",
  ],
  function(
    declare,
    _WidgetsInTemplateMixin,
    BaseWidgetSetting,
    lang,
    on) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
        //these two properties is defined in the BaseWidget
        baseClass: 'my-app-setting',
        
        startup: function () {
            this.inherited(arguments);      
            this.setConfig(this.config);
        },

        setConfig: function (config) {
            // set the setting screen to match the config file
            this.config = config;
            this.codeInput.set('value', this.config.code);
            this.logMapEvents.setValue(this.config.logMapEvents);
            this.logLayerEvents.setValue(this.config.logLayerEvents);
        },

        getConfig: function() {
            // pull the user config values from the settings menu here
            this.config.code = this.codeInput.get('value');
            this.config.logMapEvents = this.logMapEvents.getValue();
            this.config.logLayerEvents = this.logLayerEvents.getValue();
            return this.config;
        }

    });
  });