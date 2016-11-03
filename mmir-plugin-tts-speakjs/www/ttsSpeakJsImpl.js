/*
 * 	Copyright (C) 2012-2016 DFKI GmbH
 * 	Deutsches Forschungszentrum fuer Kuenstliche Intelligenz
 * 	German Research Center for Artificial Intelligence
 * 	http://www.dfki.de
 * 
 * 	Permission is hereby granted, free of charge, to any person obtaining a 
 * 	copy of this software and associated documentation files (the 
 * 	"Software"), to deal in the Software without restriction, including 
 * 	without limitation the rights to use, copy, modify, merge, publish, 
 * 	distribute, sublicense, and/or sell copies of the Software, and to 
 * 	permit persons to whom the Software is furnished to do so, subject to 
 * 	the following conditions:
 * 
 * 	The above copyright notice and this permission notice shall be included 
 * 	in all copies or substantial portions of the Software.
 * 
 * 	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
 * 	OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
 * 	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
 * 	IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY 
 * 	CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, 
 * 	TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
 * 	SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * Media Module: Implementation for Text-To-Speech via speak.js library
 * 
 * @requires WebWorkers support
 * @requires typed Arrays supports
 * @requires CSP allowing blob: protocal as media-source, e.g. "media-src blob:" or "default-src blob:"
 * 
 */
newWebAudioTtsImpl = (function SpeakJsWebAudioTTSImpl(){
			
		/**  @memberOf SpeakJsWebAudioTTSImpl# */
		var _pluginName = 'speakjsTextToSpeech';
		
		/** 
		 * @type mmir.ConfigurationManager
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _configurationManager = require('configurationManager');
		
		/** 
		 * @type mmir.MediaManager
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _mediaManager = require('mediaManager');

		/** 
		 * @type mmir.LanguageManager
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _langManager = require('languageManager');

		/** 
		 * @type mmir.Constants
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _consts = require('constants');
		
		/**
		 * separator char for language- / country-code (specific to Nuance language config / codes)
		 *   
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _langSeparator = '_';
		
		/** @memberOf SpeakJsWebAudioTTSImpl# */
		var _getLangParam;
		/** @memberOf SpeakJsWebAudioTTSImpl# */
		var _getVoiceParam;
		
		/**
		 * HELPER retrieve language setting and apply impl. specific corrections/adjustments
		 * (i.e. deal with Nuance specific quirks for language/country codes)
		 *   
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _getFixedLang = function(options){
			
			var lang = _getLangParam(options, _langSeparator);

			return _langManager.fixLang('speakjs', lang);
		};
		
		/**  @memberOf SpeakJsWebAudioTTSImpl# */
		var generateTTSURL = function(text, options){
			
			//get authentification info from configuration.json:
			// "<plugin name>": { "appId": ..., "appKey": ... }
			// -> see Nuance developer account for your app-ID and app-key
			var appId= _configurationManager.get([_pluginName, 'appId'], true, null);
			var appKey= _configurationManager.get([_pluginName, 'appKey'], true, null);
			
			if(!appKey || !appId){
				var msg = 'Invalid or missing authentification information for appId "'+appId+'" and appKey "'+appKey+'"';
				console.error(msg);
				if(onerror){
					onerror(msg);
				}
				return;////////////////////////////// EARLY EXIT ////////////////////
			}
			
			var baseUrl = _configurationManager.get(
					[_pluginName, 'serverBasePath'], true, 
					'https://tts.nuancemobility.net:443/NMDPTTSCmdServlet/tts'	//<- default value
			);
			
			var langParam;
			var voice = _getVoiceParam(options);
			if(voice){
				langParam = '&voice=' + voice;
			} else {
				langParam = '&ttsLang=' + _getFixedLang(options);	
			}
			
			//NOTE: text is not set in URL string, but in POST body
//			text = encodeURIComponent(text);
			
			return baseUrl + '?appId=' + appId + '&appKey=' + appKey + langParam;
		};
		
		/**  @memberOf SpeakJsWebAudioTTSImpl# */
		var createAudio = function(sentence, options, onend, onerror, oninit){
			
			var emptyAudio = _mediaManager.createEmptyAudio();
			
			sendRequest(sentence, emptyAudio, options, onend, onerror, oninit);
			
			return emptyAudio;
			
		};
		
//		if(typeof Recorder === 'undefined'){//debug: for saving generated audio as file -> load Recorder, if not already loaded
//	    	require('commonUtils').getLocalScript(_consts.getMediaPluginPath()+'recorderExt.js', function(){
//	    		REC = Recorder;
//	    	});
//	    }
		
		/**  @memberOf SpeakJsWebAudioTTSImpl# */
		var sendRequest = function(currSentence, audioObj, options, onend, onerror, oninit){
						
			/**
			 * Callback that handles the raw, generated WAV data
			 * 
			 * @param {Array} data
			 * 				WAV data (incl. header):
			 * 				mono (1 channel), 32bit float, sample rate 22050 Hz
			 */
			var ajaxSuccess = function(data){
					
				//console.log(oReq.response);
				
//				audioObj.req = null;
				
				//do not preceed, if audio was already canceled
				if(!audioObj.isEnabled()){
					return;///////////////// EARLY EXIT //////////////
				}
				
				//convert number-array to binary
				var buffer=new ArrayBuffer(data.length);
		        new Uint8Array(buffer).set(data);
				
				var wavBlob = new Blob( [new DataView(buffer)] );
				
//				Recorder.forceDownload(wavBlob);//debug: trigger download for wav-file
				
				_mediaManager.getWAVAsAudio(wavBlob,
						null,//<- do not need on-created callback, since we already loaded the audio-data at this point
						onend, onerror, oninit,
						audioObj
				);

					
			};
			
			var id = '' + (++_idCounter);//FIXME handle overflow!
			var args = {
				id: id,
				text: currSentence,
				options: options
			}
			
			_pending[id] = ajaxSuccess;
			
			//TODO add timeout handling -> invokes onerror
			
			_worker.postMessage(args);
		};
		
		var _pending = {};
		var _idCounter = 0;
		

		var workerPath = _consts.getWorkerPath() + 'speakWorkerExt.js';
		var _worker = new Worker(workerPath);
		/**
		 * 
		 */
		_worker.onmessage = function(event) {
			
			var msg = event.data;
			var id = msg.id;
			
			if(_pending[id]){
				
				var handler = _pending[id];
				delete _pending[id];
				
				handler(msg.data);
				
			} else {
				_mediaManager._log.error('Error: callback for audio ['+id+'] cannot be found!');
			}
	    };
		
		/**  @memberOf SpeakJsWebAudioTTSImpl# */
		return {
			/**
			 * @public
			 * @memberOf SpeakJsWebAudioTTSImpl.prototype
			 */
			getPluginName: function(){
				return _pluginName;
			},
			/**
			 * @public
			 * @memberOf SpeakJsWebAudioTTSImpl.prototype
			 */
			getCreateAudioFunc: function(){
				return createAudio;
			},
			/**
			 * @public
			 * @memberOf SpeakJsWebAudioTTSImpl.prototype
			 */
			setLangParamFunc: function(getLangParamFunc){
				_getLangParam = getLangParamFunc;
			},
			/**
			 * @public
			 * @memberOf SpeakJsWebAudioTTSImpl.prototype
			 */
			setVoiceParamFunc: function(getVoiceParamFunc){
				_getVoiceParam = getVoiceParamFunc;
			}
		};//END: return { ...
})();
