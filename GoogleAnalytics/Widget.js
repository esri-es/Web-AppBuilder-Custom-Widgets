define([
  "dojo/_base/declare",
  "dojo/_base/array",
   "dojo/_base/lang",
   "dojo/dom-style",
   "dojo/on",
   "dojo/query",
  "jimu/BaseWidget"
], function(
  declare,
  array,
  lang,
  domStyle,
  on,
  query,
  BaseWidget
) {

  var clazz = declare([BaseWidget], {
    //these two properties are defined in the BaseWiget
    baseClass: 'google-analytics',
    name: 'GoogleAnalytics',
    logMapEvents: false, // defaults to false, gets set from config
    logLayerEvents: false, // defaults to false, gets set from config

    // add additional properties here

    postCreate: function () {
        // summary:
        //      Overrides method of same name in dijit._Widget.
        
        //console.log("Init Google Analytics")
        // This starts the google analytics code (do not delete)
        eval(this.config.code)
        // Event
        ga('send', 'event', 'Widget', 'Google Analytics', 'postCreate');


        // set whether to log map/layer events
        this.logMapEvents = this.config.logMapEvents;
        this.logLayerEvents = this.config.logLayerEvents;

      // summary:
      //      Overrides method of same name in dijit._Widget.
      // tags:
      //      private
      this.inherited(arguments);
      //console.log('GoogleAnalytics::postCreate', arguments);
      
    },

    // start up child widgets
    startup: function() {
          // summary:
          //      Overrides method of same name in dijit._Widget.
          // tags:
          //      private
          this.inherited(arguments);
          
          //console.log('GoogleAnalytics::startup', arguments);
        
          // user selected option to log map events
          if (this.logMapEvents){
              
              // On click
              on(this.map, "click", lang.hitch(this, function (event) {
                  ga('send', 'event', 'Map Interaction', 'click', 'x:'+ event.x + " y:" + event.y);
        
              }));
        
              // On Double click
              on(this.map, "dbl-click", lang.hitch(this, function (event) {
                  ga('send', 'event', 'Map Interaction', 'dbl-click', 'x:' + event.x + " y:" + event.y);
        
              }));
        
              // On Extent Change
              on(this.map, "extent-change", lang.hitch(this, function (event) {
                  ga('send', 'event', 'Map Interaction', 'extent-change', 'delta [x,y]:[' + event.delta.x + "," + event.delta.y + "], extent[xmax,xmin,ymax,ymin]: [" + event.extent.xmax + "," + event.extent.xmin + "," + event.extent.ymax + "," + event.extent.ymin + "] levelChange:" + event.levelChange + " lod[level,scale]: [" +  event.lod.level + "," + event.lod.scale + "]");
        
              }));
              
                          // On pan
              on(this.map, "pan", lang.hitch(this, function (event) {
                  ga('send', 'event', 'Map Interaction', 'pan', 'delta [x,y]:[' + event.delta.x + "," + event.delta.y + "], extent[xmax,xmin,ymax,ymin]: [" + event.extent.xmax + "," + event.extent.xmin + "," + event.extent.ymax + "," + event.extent.ymin + "]");
        
              }));
        
                // On Zoom
              on(this.map, "zoom", lang.hitch(this, function (event) {
                  ga('send', 'event', 'Map Interaction', 'zoom', 'anchor [x,y]:[' + event.x + "," + event.y + "], extent[xmax,xmin,ymax,ymin]: [" + event.extent.xmax + "," + event.extent.xmin + "," + event.extent.ymax + "," + event.extent.ymin + "]" + " zoomFactor: " +event.zoomFactor);
        
              }));
         }
     
         // user selected option to log layer events
         if (this.logLayerEvents){
              
              //Log Layers in the map
              array.forEach(this.map.layerIds, lang.hitch(this, function (id) {
                  var layer = this.map.getLayer(id);
                  ga('send', 'event', 'Layers', layer.id, layer.url);
              }));
        
              // Track New Layers 
              on(this.map, "layer-add", lang.hitch(this, function (event) {
                  var layer = event.layer
                  ga('send', 'event', 'Layers', 'layer-add', 'id:' + layer.id + " url:" + layer.url);
        
              }));
        
              // Track Removed Layers 
              on(this.map, "layer-remove", lang.hitch(this, function (event) {
                  var layer = event.layer
                  ga('send', 'event', 'Layers', 'layer-remove', 'id:' + layer.id + " url:" + layer.url);
        
              }));
         }
         
         // hide the icon in the menu bar  
        this._hideMenuIcon(this.id, this.label);
         //end startup()      
    },

    onOpen: function () {
      // summary:
      //      Overrides method of same name in jimu._BaseWidget.
      
      //console.log('GoogleAnalytics::onOpen', arguments);
      // add code to execute whenever the widget is opened
    },

    onClose: function() {
      // summary:
      //      Overrides method of same name in jimu._BaseWidget.
      
      //console.log('GoogleAnalytics::onClose', arguments);

      // add code to execute whenever the widget is closed
    },
    
    _hideMenuIcon:function(id, label){
        // should work with all themes
        // Usage, takes id and label and selects div element with a matching settingid or title.
        // Some themes use a settingsid, others use title
        //The only items that will have this are the icon divs.
        
        function hide(nodes){
            // run in loop just in case we get more than one node
            array.forEach(nodes, function(node){
                domStyle.set(node, "display", "none");
            });
        }
        
        var byId, byLabel, qryById, qryByLabel;
        
        qryById = "[settingid=\'" + id + "\']";
        nodesById = query(qryById);
        qryByLabel = "[title=\'" + label + "\']";
        nodesByLabel = query(qryByLabel);
        
        if (nodesById.length > 0){
            hide(nodesById);
        }
        else if (nodesByLabel.length > 0){
            hide(nodesByLabel);
        }
        else{
            alert("Google Analytics Widget Failed to Hide it's Icon.  Widget not supported with this theme");
        }
    }

  });

  return clazz;
});