

var fs = require('fs');
var path = require('path');
var DOMParser = require('xmldom').DOMParser;


var npmConfig = require('./util/npm-config');

var CONFIG_NAME_ASSETS_MODULE_DIR = npmConfig.ASSETS_MODULE_DIR; 
var CONFIG_NAME_TARGET_WWW_DIR    = npmConfig.TARGET_WWW_DIR;

/**
 * flag:
 * check plugin.xml and config.xml strictly, i.e. xmlns attributes must have correct values.
 */
var checkXmlStrict = true;

function getSourcePluginPaths(isConfigModulePath, invokingModulePath, instMod) {
//find plugin.xml file, that contain the plugin's <asset> declarations
    var paths = [], xmlPath;
    var isError;
    if (isConfigModulePath) {

        invokingModulePath = path.normalize(invokingModulePath);

        xmlPath = getPluginXmlPath(invokingModulePath);
        if (xmlPath) {
            paths.push(xmlPath);
        } else {
            isConfigModulePath = false;
            console.log('WARNING could not find plugin.xml in confuration path ' + invokingModulePath + ', trying to detect path...');
        }
    }

    try {

        if (isConfigModulePath) {
            invokingModulePath = path.normalize(isConfigModulePath);
        } else {
            invokingModulePath = path.dirname(require.resolve(instMod));
        }

        xmlPath = getPluginXmlPath(invokingModulePath);

        if (xmlPath) {
            paths.push(xmlPath);
        } else {
            console.error(
                'ERROR could not find plugin.xml in path from configuration value ' +
                CONFIG_NAME_ASSETS_MODULE_DIR + ': ' + invokingModulePath);
            isError = true;
        }

    } catch (ex) {
        //DEBUG:
        // console.log('ERROR resolve invoking mdoule: ' + instMod +', error: '+ex);//+', stack: '+ex.stack);
        // console.log('trying to extract module path form env.Path instead ...');
    }

    if (paths.length < 1) {

        //HACK npm adds the invoking module to the environment's path -> try to extract
        //     the module's path by processing the process' Path variable

        paths = getInvokingModuleFromEnvPath(paths, instMod);

        if (paths.length !== 1) {

            if (paths.length > 1)
                console.log('WARNING found multpiple directories (' + paths.length + ') that may contain the plugin defintion');
            else {
                console.error(
                    'ERROR could not find path for the plugin.xml.' +
                    ' You can use the configuration value ' + CONFIG_NAME_ASSETS_MODULE_DIR +
                    ' in package.json for specifying the absolute path to the root' +
                    ' directory of the plugin with the assets (i.e. the directory' +
                    ' where the plugin.xml can be found).');
                isError = true;
            }
        }

    }
    return {paths: paths, invokingModulePath: invokingModulePath, error: isError};
}

function getTargetAssetPath(isConfigWwwPath, isCheckXmlStrict, mode) {

    var isTargetDirDetected = true;
    var wwwPath;
    if (isConfigWwwPath) {

        var projectRoot = isConfigWwwPath.replace(/www[\/]?$/ig, '');
        //TODO should we really verify that its the Cordova project's www
        //     (i.e. check for config.xml in the project's root), or
        //     should we just check for existence of the target directory?
        if (isCordovaProjectRoot(projectRoot, isCheckXmlStrict)) {
            wwwPath = isConfigWwwPath;
        } else {
            isTargetDirDetected = false;
        }

    }
    else {

        //try to detect Cordova project path in the working dir's parents
        var workingDir = process.cwd();
        wwwPath = extractPathEndingWith(workingDir, 'node_modules', function verifyPath(foundPath) {

            //find path that has /www as sibling to /node_modules, ie.
            //	<path>/node_modules
            //	<path>/www
            //-> return <path>/www
            var rootPath = foundPath.substring(0, foundPath.length - 'node_modules'.length);
            var wwwPath = path.join(rootPath, 'www');

            if (exists(wwwPath) && isCordovaProjectRoot(rootPath, isCheckXmlStrict)) {

                return wwwPath;
            }
            return false;
        });

        if (wwwPath) {//FIXME debug
            console.log('######## modify resource target-root: ' + wwwPath);
            var newp = wwwPath.replace(/www\/?$/, '');
            wwwPath = path.join(newp, 'src', 'assets');
            console.log('######## new resource target-root: ' + wwwPath);
        }

        if (!wwwPath) {

            isTargetDirDetected = false;
            console.log('WARNING could not determine root directory for Cordova project! ' +
                'you will have to ' + (mode === 'install' ? 'copy' : 'remove') +
                ' the assets manually ' + (mode === 'install' ? 'to' : 'from') +
                ' the /www directory of your project.\n' +
                ' You can use the configuration value ' + CONFIG_NAME_TARGET_WWW_DIR +
                ' in package.json for specifying the absolute path to the plubin\'s /www');
            //NOTE continue: print source/target paths for assets that need to be
        }
    }
    return {isTargetDirDetected: isTargetDirDetected, wwwPath: wwwPath};
}
function doProcessAssets(paths, mode, isCheckXmlStrict, wwwPath, isTargetDirDetected) {
    
    var i, size = paths.length;

    var currentCount = 0;
    var completeCount = 0;
    var checkComplete = function (dirIndex, isIncrease) {
        if (isIncrease) {
            ++currentCount;
        }
//		console.log('  check complete['+dirIndex+'].size('+size+'): '+currentCount+'/'+completeCount+' -> '+(dirIndex >= size - 1 && currentCount >= completeCount));
        if (dirIndex >= size - 1 && currentCount >= completeCount) {
            console.log('----------------------------------------------------------\n');
        }
    };

    //process the plugin.xml: find <asset> elments and copy the source files to the target location
    for (i = 0; i < size; ++i) {

        if (mode === 'install') {
            console.log('  Copying assets from plugin directory at : ' + paths[i]);
        }

        try {

            var xml = loadXml(paths[i]);

            // console.log(xml);
            if (isPluginXml(xml, isCheckXmlStrict)) {

                var pluginDir = path.dirname(paths[i]);

                var assets = xml.getElementsByTagName('asset');
                var asset, strSrc, src, strTarget, target;
                for (var j = 0, len = assets.length; j < len; ++j) {

                    asset = assets[j];
                    strSrc = getAttr(asset, 'src');
                    if (!strSrc) {
                        console.error('ERROR <asset> has no src attribute!');
                        if (mode === 'install') {
                            //cannot copy asset, if source is missing:
                            checkComplete(i);
                            continue;
                        }
                    }
                    src = path.resolve(pluginDir, strSrc);

                    strTarget = getAttr(asset, 'target');
                    if (!strTarget) {
                        console.error('ERROR <asset> has no target attribute! asset.src: ' + src);
                        checkComplete(i);
                        continue;
                    }
                    target = path.resolve(wwwPath, strTarget);

                    if (isTargetDirDetected) {

                        //increase complete-count, since we will actually do something with a file
                        ++completeCount;

                        if (mode === 'install') {

                            //create target directories, if necessary
                            mkDirs(path.dirname(target));

                            (function (strSrc, src, strTarget, target, i) {
                                //ASYNC copy
                                copy(src, target, function (err) {
                                    if (err) {
                                        console.error('    ERROR failed to copy asset from ' + src + ' to ' + target + ', ' + err);
                                    } else {
                                        console.log('    copied asset ' + strSrc + ' -> ' + strTarget);
                                    }
                                    checkComplete(i, true);
                                });
                            })(strSrc, src, strTarget, target, i);

                        } else {

                            if (!exists(target)) {
                                console.log('    WARNING cannot remove asset file, because it does not exist in target location ' + target);
                                checkComplete(i, true);
                                continue;
                            }

                            (function (strSrc, src, strTarget, target, i) {
                                //ASYNC delete
                                fs.unlink(target, function (err) {
                                    if (!err) {
                                        console.log('    removed asset from ' + strTarget);
                                    } else {
                                        console.error('    ERROR failed to remove asset from ' + target + ', ' + err);
                                    }
                                    checkComplete(i, true);
                                });
                            })(strSrc, src, strTarget, target, i);
                        }

                    } else {
                        console.log('    Asset file: ' + src);
                        checkComplete(i);
                    }

                }//END for(tags in plugin)

            } else {
                console.error(
                    'ERROR XML at ' + paths[i] + ' is not a valid plugin.xml definition.' +
                    ' Verify that it has the correct xmlns attribute definition and' +
                    ' contains a valid <plugin> element');
                checkComplete(i);
            }

        } catch (err) {
            console.error('ERROR could open plugin.xml at ' + paths[i] + ': ' + err);
            checkComplete(i);
        }
    }

    if (size === 0) {
        checkComplete(1);
    }
}
/**
 *
 * @param {Object} options the options for processing the plugin's assets
 * @param {String} options.assetsModuleId
 * 						the ID of the module which contains the plugin assets that should be copied (or uninstalled).
 * 						This ID is used for trying to detect the file path to the target plugin.
 * 						This is required, if <code>assetsModulePath</code> is not specified.
 * @param {String} options.assetsModulePath
 * 						the absolute path to the module which contains the plugin assets that should be copied (or uninstalled).
 * 						If this is missing, <code>assetsModuleId</code> must be specified.
 * @param {String} [options.cordovaProjectWwwPath]	OPTIONAL
 * 						the absolute path to the Cordova project's /www directory, i.e. where the assets should be copied to (or uninstalled from).
 * 						If this is missing, the location is detected by traversing the module's parent
 * 						directories.
 * @param {Boolean} [options.checkXmlStrict]	OPTIONAL
 * 						if <code>true</code>, verifying the plugin.xml file (for the plugin with the assets)
 * 						and the config.xml file (for the Cordova project) will be strict, i.e. file must
 * 						contain correct xmlns definitions).
 * 						NOTE: if the value is not a <code>boolean</code>, the default will be used (i.e.
 * 							  no FLASY or TRUTHY values are accepted).
 * 						DEFAULT: true
 * 
 * @param {String} mode
 * 						one of 'install' | 'uninstall'
 * 						DEFAULT: 'install'
 * 
 * @returns {Boolean}
 * 			<code>false</code> if source/target for determining assets and copying/removing asset files was NOT successful.
 * 
 * @public
 * 		
 */
function processAssets(options, mode){

	var instMod = options.assetsModuleId;
	var invokingModulePath = options.assetsModulePath;
	var targetWwwPath = options.cordovaProjectWwwPath;
	
	var isCheckXmlStrict = typeof options.checkXmlStrict === 'boolean'? options.checkXmlStrict : checkXmlStrict;
	
	console.log('\n----------------------------------------------------------');
	console.log((mode === 'uninstall'?'un':'')+'installing Cordova Plugin assets for '+instMod);
	
	var isConfigModulePath = !!invokingModulePath;
	var isConfigWwwPath = !!targetWwwPath;
    var pluginPathsResult = getSourcePluginPaths(isConfigModulePath, invokingModulePath, instMod);
    var paths = pluginPathsResult.paths;
    invokingModulePath = pluginPathsResult.invokingModulePath;
    if(pluginPathsResult.error){
        return false;//////////////// EARLY EXIT ////////////////////////
    }

    var assetPathResult = getTargetAssetPath(isConfigWwwPath, isCheckXmlStrict, mode);
    var isTargetDirDetected = assetPathResult.isTargetDirDetected;
    var wwwPath = assetPathResult.wwwPath;

    if(wwwPath){
		console.log('  Target directory for '+(mode === 'install'? 'copying' : 'removing')+' assets: '+wwwPath);
	}
    doProcessAssets(paths, mode, isCheckXmlStrict, wwwPath, isTargetDirDetected);
	
	//completed
	return isTargetDirDetected;//TODO return INT code instead of boolean?
}

function copyAssets(options){
	return processAssets(options, 'install');
}

function removeAssets(options){
	return processAssets(options, 'uninstall');
}

////////////////////////////////////////////////// HELPER FUNCITONS //////////////////////////////////////////////

/**
 * @param {Array<String>} [foundPaths]
 * 			 an array in which to store found paths.
 * 			 If omitted, a new array is created and returned
 * @param {String} moduleId
 * 			 the (npm) ID of the module
 * 
 * @returns {Array<String>} the String-Array of found paths (i.e. foundPaths)
 */
function getInvokingModuleFromEnvPath(foundPaths, moduleId){
	
	foundPaths = foundPaths? foundPaths : [];
	var pathVar = process.env.Path;
	var pathList = pathVar.split(path.delimiter);
	var p, seg, i, size, xmlPath;
	for(i=0, size = pathList.length; i < size; ++i){
	
		p = pathList[i];
		seg = p.split(path.sep);
		
		//find paths that end with the module's ID, i.e. last path-segment equals the module's ID
		xmlPath = extractPathEndingWith(p, moduleId, function verifyPath(foundPath){
			//assume we have found the correct path, if there also exist the plugin.xml file, i.e.
			// <some path>/<module id>/plugin.xml
			//-> return the plugin.xml-path
			foundPath = getPluginXmlPath(foundPath);
			if(foundPath)
				return foundPath;
			return false;
		});
		
		if(xmlPath){
			// console.log('found plugin.xml at '+xmlPath);
			foundPaths.push(xmlPath);
		}
	}
	
	return foundPaths;
}

/**
 * @param {String} completePath
 * @param {String} pathSegment
 * @param {Function} verifyFunc
 *         function(foundPath) for checking found paths.
 *			if returns FALSE: continue search
 *			if returns TRUE: this function will return foundPath
 *			if returns STRING: this function will return this string instead of the foundPath (IFF the string is not empty)
 */
function extractPathEndingWith(completePath, pathSegment, verifyFunc){
	var seg = completePath.split(path.sep);
	for(var j=seg.length -1; j >= 0; --j){
		if(seg[j] === pathSegment){
			var targetPath = seg.slice(0,j+1).join(path.sep);
			// console.log('found "'+seg[j]+'" at '+j+': path is '+targetPath);//FIXM debug
			var result = verifyFunc(targetPath);
			if(typeof result === 'string'){
				targetPath = result;
			}
			if(targetPath){
				return targetPath;
			}
		}
	}
}

function exists(thePath){
	try{//test for existence:
		fs.statSync(thePath);
		return true;
	} catch (err){
		return false;
	}
}

function mkDirs(thePath){
	var seg = thePath.split(path.sep);
	var tempPath;
	for(var i=0, size = seg.length; i < size; ++i){
		tempPath = seg.slice(0, i+1).join(path.sep);
		if(!exists(tempPath)){
			fs.mkdirSync(tempPath);
		}
	}
}

/**
 * 
 * @async
 * 
 * @param srcPath
 * @param targetPath
 * @param onFinished
 * @param onError
 */
function copy(srcPath, targetPath, onFinished){
	
	var isFinished = false;
	var instream, outstream;
	
	instream = fs.createReadStream(srcPath);
	instream.on('error', function(err){done(err); });
	outstream = fs.createWriteStream(targetPath);
	outstream.on('error', function(err){done(err);});
	outstream.on('close', function(err){done(err);});
	
	instream.pipe(outstream);

	function done(err){
		if(!isFinished){//guard flag, so that callback may only be invoked once
			isFinished = true;
			onFinished(err);
		}
	}
}

//get plugin.xml path for a plugin-dir
function getPluginXmlPath(pluginDir){
	var xmlPath = path.join(pluginDir, 'plugin.xml');
	if(exists(xmlPath)){
		return xmlPath;
	}
}

//open the plugin.xml file as XML document
function loadXml(xmlPath){

	var content = fs.readFileSync(xmlPath, 'utf8');
	var hasErrors = false;
	var doc = new DOMParser({
		locator:{},
		errorHandler:{
			warning:function(w){console.warn(w)},
			error:function(msg){
				console.error('ERROR loading XML '+msg);
				hasErrors = true;
			},
			fatalError:function(msg){
				console.error('ERROR loading XML '+msg);
				hasErrors = true;
			}
		}
	}).parseFromString(content,'text/xml');
	
	if(hasErrors){
		console.error('ERROR could not load invalid XML at '+xmlPath);
		return;////////////////// EARLY EXIT ///////////////////
	}
	
	return doc;
}

function getAttr(node, attrName, ns){
	
	var attr = ns? 
		  node.attributes.getNamedItemNS(ns, attrName)
		: node.attributes.getNamedItem(attrName);
		  
	if(attr && typeof attr.nodeValue !== 'undefined'){
		return attr.nodeValue;
	}
	
	return null;
}

function isPluginXml(xmlDoc, checkStrict){
	
	if(!xmlDoc){
		return false;///////////// EARLY EXIT ///////////////
	}
	
//	<plugin 
//		id=<id>
//		version=<version>
//		xmlns="http://cordova.apache.org/ns/plugins/1.0">
	
	var pluginTags = xmlDoc.getElementsByTagName('plugin');
	var reDetect = /cordova\.apache\.org\/ns\/plugins/i;
	var attr;
	for(var i=0,size=pluginTags.length; i< size; ++i){
		// console.log('  checking attributes of <plugin>['+i+']: '+pluginTags[i].attributes.length);
		attr = getAttr(pluginTags[i], 'xmlns');
		if(attr && reDetect.test(attr)){
			return true; ///////////////// EARLY EXIT /////////////////////////
		}
	}
	
	var isPluginXml = checkStrict? false : pluginTags.length > 0; 
	
	return isPluginXml;
}

function isConfigXml(xmlDoc, checkStrict){

	if(!xmlDoc){
		return false;///////////// EARLY EXIT ///////////////
	}
	
//	<widget id=<id>
//    	version=<version>
//    	xmlns="http://www.w3.org/ns/widgets"
//    	xmlns:cdv="http://cordova.apache.org/ns/1.0">
	
	var widgetTags = xmlDoc.getElementsByTagName('widget');
	var reDetect = /www\.w3\.org\/ns\/widgets/i;
	var attr;
	for(var i=0,size=widgetTags.length; i< size; ++i){
		// console.log('  checking attributes of <widget>['+i+']: '+widgetTags[i].attributes.length);
		attr = getAttr(widgetTags[i], 'xmlns');
		if(attr && reDetect.test(attr)){
			return true; ///////////////// EARLY EXIT /////////////////////////
		}
	}
	
	var isConfigXml = checkStrict? false : widgetTags.length > 0; 
	
	return isConfigXml;
}

function isCordovaProjectRoot(rootPath, checkStrict){
	
	//verify that Cordova's config.xml is present in root
	var configPath = path.join(rootPath, 'config.xml');
	var configXml = loadXml(configPath);
	
	if(isConfigXml(configXml, checkStrict)){
		
		return true;	
	}
	return false;
}

////////////////////////////////////////////////////// MODULE EXPORTS //////////////////////////////

module.exports.copyAssets = copyAssets;
module.exports.removeAssets = removeAssets;