define([
  'dojo/_base/declare',
  'jimu/BaseWidget'
], function(
  declare,
  BaseWidget
) {

  var clazz = declare([BaseWidget], {
    //these two properties are defined in the BaseWiget
    baseClass: 'html-widget',
    name: 'HTML',

    // add additional properties here

    postCreate: function() {
      // summary:
      //      Overrides method of same name in dijit._Widget.
      // tags:
      //      private
      this.inherited(arguments);
      console.log('HTML::postCreate', arguments);

      // add additional post constructor logic here

      

    },

    // start up child widgets
    startup: function() {
      // summary:
      //      Overrides method of same name in dijit._Widget.
      // tags:
      //      private
      this.inherited(arguments);
      console.log('HTML::startup', arguments);

      this.domNode.innerHTML = this.config.inPanelVar.params.htmlCode
    },

    onOpen: function() {
      // summary:
      //      Overrides method of same name in jimu._BaseWidget.
      console.log('HTML::onOpen', arguments);

      // add code to execute whenever the widget is opened
    },

    _showLayer: function() {
    },

    _hideLayer: function() {
    },    

    onClose: function() {
      // summary:
      //      Overrides method of same name in jimu._BaseWidget.
      console.log('HTML::onClose', arguments);

      // add code to execute whenever the widget is closed
    }
  });

  return clazz;
});
