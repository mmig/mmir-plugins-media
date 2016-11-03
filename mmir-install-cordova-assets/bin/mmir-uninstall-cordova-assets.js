#!/usr/bin/env node

var npmOptions = require('../util/npm-config.js');

function doStart(){
	
	var installAssets = require('mmir-install-cordova-assets');
	
	//TODO add cmd support?
	
	var options = npmOptions.getConfigOptions();
	
	options.callback = function onComplete(error){
		if(error){
			//-> an error occurred
			process.exit(1);
		} else {
			process.exit(0);
		}
	}
	
	installAssets.removeAssets(options);
}

doStart();
