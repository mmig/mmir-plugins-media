#!/usr/bin/env node

var npmOptions = require('../util/npm-config.js');

function doStart(){
	
	var installAssets = require('mmir-install-cordova-assets');
	
	//TODO add cmd support?
	var result = installAssets.removeAssets(npmOptions.getConfigOptions());
	
	if(!result){
		//-> an error occurred
		process.exit(1);
	}
}

doStart();
