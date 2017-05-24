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
		 * legacy mode: use pre-v4 API of mmir-lib
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _isLegacyMode = true;
		/** 
		 * Reference to the mmir-lib core (only available in non-legacy mode)
		 * @type mmir
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _mmir = null;
		
		//get mmir-lib core from global namespace:
		_mmir = window[typeof MMIR_CORE_NAME === 'string'? MMIR_CORE_NAME : 'mmir'];
		if(_mmir){
			// set legacy-mode if version is < v4
			_isLegacyMode = _mmir? _mmir.isVersion(4, '<') : true;
		}
		
		/**
		 * HELPER for require(): 
		 * 		use module IDs (and require instance) depending on legacy mode
		 * 
		 * @param {String} id
		 * 			the require() module ID
		 * 
		 * @returns {any} the require()'ed module
		 * 
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _req = function(id){
			var name = (_isLegacyMode? '' : 'mmirf/') + id;
			return _mmir? _mmir.require(name) : require(name);
		};
		
		/** 
		 * @type mmir.MediaManager
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _mediaManager = _req('mediaManager');

		/** 
		 * @type mmir.LanguageManager
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _langManager = _req('languageManager');

		/** 
		 * @type mmir.Constants
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _consts = _req('constants');
		
		/**
		 * separator char for language- / country-code (specific to Nuance language config / codes)
		 *   
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var _langSeparator = '-';
		
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
		var _setNumOpt = function(name, source, target){

			if(source && source[name] && isFinite(source[name])){
				target[name] = source[name];
			}
			
		};
		
		/**  @memberOf SpeakJsWebAudioTTSImpl# */
		var getTTSOptions = function(options){
			
//			args['amplitude'] ? String(args['amplitude']) : '100',
//		    args['wordgap'] ? String(args['wordgap']) : '0', // wordgap: Additional gap between words in 10 ms units (default: 0)
//		    args['pitch'] ? String(args['pitch']) : '50',
//		    args['speed'] ? String(args['speed']) : '175',
//		    args['voice'] ? String(args['voice']) : 'en-us',
		    		
			var opts = {};
			
			var voice = _getVoiceParam(options);
			if(!voice){
				voice = _getFixedLang(options);	
			}
			if(voice){
				opts.voice = voice;
			}
			
			_setNumOpt('amplitude', options, opts);
			_setNumOpt('wordgap', options, opts);
			_setNumOpt('pitch', options, opts);
			_setNumOpt('speed', options, opts);
			
			return opts;
		};
		
		/**  @memberOf SpeakJsWebAudioTTSImpl# */
		var createAudio = function(sentence, options, onend, onerror, oninit){
			
			var emptyAudio = _mediaManager.createEmptyAudio();
			
			sendRequest(sentence, emptyAudio, getTTSOptions(options), onend, onerror, oninit);
			
			return emptyAudio;
			
		};
		
//		if(typeof Recorder === 'undefined'){//debug: for saving generated audio as file -> load Recorder, if not already loaded
//	    	_req('commonUtils').getLocalScript(_consts.getMediaPluginPath()+'recorderExt.js', function(){
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
			var onSuccess = function(data){
					
				//console.log(oReq.response);
				
//				audioObj.req = null;
				
				//do not preceed, if audio was already canceled
				if(!audioObj.isEnabled()){
					return;///////////////// EARLY EXIT //////////////
				}
				
				var buffer;
				if(data instanceof ArrayBuffer){
					buffer = data;
				} else {
					//convert number-array to binary
					buffer=new ArrayBuffer(data.length);
					new Uint8Array(buffer).set(data);
				}
				
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
			
			_pending[id] = {success: onSuccess, error: onerror};
			
			//TODO add timeout handling -> invokes onerror
			
			_worker.postMessage(args);
		};
		
		var _pending = {};
		var _idCounter = 0;
		

		var workerPath = _consts.getWorkerPath() + 'speakWorkerExt.js';
		var _worker = new Worker(workerPath);
		/**
		 * @memberOf SpeakJsWebAudioTTSImpl.worker
		 */
		_worker.onmessage = function(event) {
			
			var msg = event.data;
			var id = msg.id;
			var handler, data;
			
			if(_pending[id]){
				
				if(msg.error){
					handler = _pending[id].error;
					data = msg.message;
				} else {
					handler = _pending[id].success;
					data = msg.data;
				}
				
				delete _pending[id];
				handler(data);
				
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
