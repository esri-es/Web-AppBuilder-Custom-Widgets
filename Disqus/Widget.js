define([
  'dojo/_base/declare',
  'jimu/BaseWidget'
], function(
  declare,
  BaseWidget
) {

  var clazz = declare([BaseWidget], {
    //these two properties are defined in the BaseWiget
    baseClass: 'my-widget',
    name: 'Disqus',

    // add additional properties here

    postCreate: function() {
      // summary:
      //      Overrides method of same name in dijit._Widget.
      // tags:
      //      private
      this.inherited(arguments);
      console.log('Disquss::postCreate', arguments);

      // add additional post constructor logic here
      

      
    },

    // start up child widgets
    startup: function() {
      // summary:
      //      Overrides method of same name in dijit._Widget.
      // tags:
      //      private
      this.inherited(arguments);
            
      var localThis = this;
      var disqus_config = function (localThis) {
          this.page.url = localThis.config.inPanelVar.params.pageUrl;  // Replace PAGE_URL with your page's canonical URL variable
          this.page.identifier = localThis.config.inPanelVar.params.pageIdentifier; // Replace PAGE_IDENTIFIER with your page's unique identifier variable
      };
      
      (function(localThis) {  // REQUIRED CONFIGURATION VARIABLE: EDIT THE SHORTNAME BELOW
          var d = document, s = d.createElement('script');
          
          s.src = '//'+localThis.config.inPanelVar.params.shortName+'.disqus.com/embed.js';  // IMPORTANT: Replace EXAMPLE with your forum shortname!
          
          s.setAttribute('data-timestamp', +new Date());
          (d.head || d.body).appendChild(s);
      })(localThis);
      console.log('Disquss::startup', arguments);
    },

    onOpen: function() {
      // summary:
      //      Overrides method of same name in jimu._BaseWidget.
      console.log('Disquss::onOpen', arguments);

      // add code to execute whenever the widget is opened
    },

    _showLayer: function() {
    },

    _hideLayer: function() {
    },    

    onClose: function() {
      // summary:
      //      Overrides method of same name in jimu._BaseWidget.
      console.log('Disquss::onClose', arguments);

      // add code to execute whenever the widget is closed
    }
  });

  return clazz;
});
