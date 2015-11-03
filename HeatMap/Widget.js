define([
  'dojo/_base/declare',
  'jimu/BaseWidget',
  "esri/layers/FeatureLayer",
  "esri/renderers/HeatmapRenderer"
], function(
  declare,
  BaseWidget,
  FeatureLayer,
  HeatmapRenderer
) {

  var clazz = declare([BaseWidget], {
    //these two properties are defined in the BaseWiget
    baseClass: 'my-widget',
    name: 'HeatMap',

    // add additional properties here

    postCreate: function() {
      // summary:
      //      Overrides method of same name in dijit._Widget.
      // tags:
      //      private
      this.inherited(arguments);
      console.log('HeatMap::postCreate', arguments);

      // add additional post constructor logic here
      if(this.config.inPanelVar){
        //debugger;
        console.log('CARGADO:' + this.config.inPanelVar.params.featureServiceUrl)
        var serviceURL = this.config.inPanelVar.params.featureServiceUrl;
        var heatmapFeatureLayer = new FeatureLayer(serviceURL, { mode: FeatureLayer.MODE_SNAPSHOT});
        var heatmapRenderer = new HeatmapRenderer();
        heatmapFeatureLayer.setRenderer(heatmapRenderer);
        this.map.addLayer(heatmapFeatureLayer);
      }

      
    },

    // start up child widgets
    startup: function() {
      // summary:
      //      Overrides method of same name in dijit._Widget.
      // tags:
      //      private
      if(this.config.inPanelVar){
        this.inherited(arguments);
        console.log('Layer:' + this.config.inPanelVar.params.featureServiceUrl)
        console.log('HeatMap::startup', arguments);
      }
    },

    onOpen: function() {
      // summary:
      //      Overrides method of same name in jimu._BaseWidget.
      console.log('HeatMap::onOpen', arguments);

      // add code to execute whenever the widget is opened
    },

    _showLayer: function() {
    },

    _hideLayer: function() {
    },    

    onClose: function() {
      // summary:
      //      Overrides method of same name in jimu._BaseWidget.
      console.log('HeatMap::onClose', arguments);

      // add code to execute whenever the widget is closed
    }
  });

  return clazz;
});
