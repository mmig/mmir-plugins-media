

var CONFIG_NAME_ASSETS_MODULE_DIR = 'assets_module_dir';
var CONFIG_NAME_TARGET_WWW_DIR = 'target_www_dir';

//extract options from environment when invoked as npm script
function getOptionsFromNpm(){
	
	return{
		assetsModuleId: process.env.npm_package_name,
		assetsModulePath: process.env['npm_config_' + CONFIG_NAME_ASSETS_MODULE_DIR],
		cordovaProjectWwwPath: process.env['npm_config_' + CONFIG_NAME_TARGET_WWW_DIR]
	};
		
}

module.exports.ASSETS_MODULE_DIR = CONFIG_NAME_ASSETS_MODULE_DIR
module.exports.TARGET_WWW_DIR = CONFIG_NAME_TARGET_WWW_DIR;
module.exports.getConfigOptions = getOptionsFromNpm;
