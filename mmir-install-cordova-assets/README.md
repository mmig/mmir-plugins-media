# mmir-install-cordova-assets

Tool for installing Cordova Plugins <asset> definitions from npm-installed packages into the Cordova project's www folder.

This tool allows to install media-plugins via `npm` and automatically copy the media-plugin's implementation files
(i.e. the <asset> definitions in the plugn.xml file) into the Cordova project's `/www` directory.

This is done by using the Cordova plugin.xml file's <asset>-tags.


## Restrictions

NOTE: This tools does not support platform specific <asset>-tags, i.e. all <asset> are copied.

## Prerequisites

npm version >= 2.0

check npm version with `npm -v`.

## Usage in package.json

Create a [package.json][1] file in the media-plugin directory, for which you want to
enable copying/removal of asset files.

Then declare all the media-plugin(s) dependencies in the `dependency` field of the
 `package.json`, and lastly add the asset-installer as dependency, e.g.

```javascript
  ...
  "dependencies": {
	"mmir-plugin-asr-nuance-web": "file:/repo/mmir-plugins-media/mmir-plugin-asr-nuance-web",
	...
	"mmir-install-cordova-assets": "file:/repo/mmir-plugins-media/mmir-install-cordova-assets"
  },
  ...
```


For automatically copying the assets upon install (and removing them upon uninstall), declare the
asset-installer's scripts in `package.json`, e.g.
```javascript
  ...
  "scripts": {
      ...
	  "postinstall": "mmir-install-cordova-assets",
	  "preuninstall": "mmir-uninstall-cordova-assets"
  },
  ...
```

This will install (or uninstall) the assets of the media-plugin when using `npm install`
(or `npm uninstall <id>`).


## Basic JavaScript Usage

```javascript

var assetInstaller = require('mmir-install-cordova-assets');

var options = {
      //OPTIONAL (if assetsModulePath is specified)
	  //for automatically detecting folder of Cordova plugin (i.e. source of plugin assets)
	  // (must be in parent hierarchy of current working directory)
	  //[can be omitted, if assetsModulePath is specified]
    assetsModuleId: 'mmir-plugin-asr-nuance-web',
      //OPTIONAL (if assetsModuleId is specified)
	  //for explicitly specifying folder of Cordova plugin
	  // (should be an absolute path; relative paths may not work)
	  //[can be omitted, if assetsModuleId is specified, and detection mechanism works]
	assetsModulePath: 'C:\\some\\folder\\node_modules\\mmir-plugin-asr-nuance-web',
	  //OPTIONAL
	  //for automatically detecting folder of the Cordova project (i.e. target for plugin assets)
	  // (must be in parent hierarchy of a path defintion in the environment's path variable
	  //  as would be the case when the script is invoked via npm's script mechanism)
	  //[should be specified, if the asset-installer is NOT invoked via npm's script mechanism]
	cordovaProjectWwwPath: 'C:\\some\\folder\\www',
	  //OPTIONAL (default: true)
	  //detecting the plugin folder and the project folder is done by checking for
	  // the plugin's plugin.xml and the project's config.xml file.
	  //If 'strict' is enabled, the check includes verifying that the correct xmlns attributes are
	  // set within the XML files.
	checkXmlStrict: false
};

//copy assets from plugin folder
// (i.e. <asset> files that are declared in the plugin's plugin.xml)
assetInstaller.copyAssets(options);

//remove assets from project's /www folder
// (i.e. <asset> files that are declared in the plugin's plugin.xml)
assetInstaller.removeAssets(options);


```


[1]: https://docs.npmjs.com/files/package.json