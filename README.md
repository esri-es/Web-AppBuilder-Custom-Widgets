# Web-AppBuilder-Custom-Widgets
Web AppBuilder for ArcGIS - Custom Widgets Directory

## Contributions

### Add new widgets
To add new widgets to the repo is really easy:

1. Go to the language file(s), one or both as you prefer: 
  * English: [/i18n/locale-en.json](https://github.com/esri-es/Web-AppBuilder-Custom-Widgets/blob/gh-pages/i18n/locale-en.json) 
  * Spanish: [/i18n/locale-es.json](https://github.com/esri-es/Web-AppBuilder-Custom-Widgets/blob/gh-pages/i18n/locale-es.json) 
2. Click the pencil icon to "Fork and Edit" the file
3. Add at the end of the file the information about the widget you want to add:
   
   ```javascript
   {
      "id": <new number in the sequence>,
      "published": true,
      "name": "Widget name to be displayed",
      "description": "Widget description to be displayed",
      "demo": "<URL to a demo app if any. Ex. http://jimeno0.github.io/TableQueryWidget/>",
      "download": "<URL to a compressed file with the widget. Ex. https://github.com/Jimeno0/TableQueryWidget/archive/master.zip>",
      "info": "<URL to extended information. Ex. https://github.com/Jimeno0/TableQueryWidget>",
      "author": "<Author name>",
      "author_link": "URL for extended information about the author"
  }
  ```

4. Save all send the pull request

### Add new languages

1. Edit the [index.html](https://github.com/esri-es/Web-AppBuilder-Custom-Widgets/blob/gh-pages/index.html)
2. Add one line of code with the language like this: ```<li ng-click="changeLanguage('en')">English</li>``` but with the new language and language-code
3. Include a file with the language code in ```/i18n``` with the same structure and same content (but translated) and the proper language code

## Questions
Please submit [an issue](https://github.com/esri-es/Web-AppBuilder-Custom-Widgets/issues) for any question you may have :)
