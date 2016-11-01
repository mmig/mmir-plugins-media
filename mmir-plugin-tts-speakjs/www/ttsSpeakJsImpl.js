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
		
//		/** 
//		 * @type jQuery
//		 * @memberOf SpeakJsWebAudioTTSImpl#
//		 */
//		var jquery = require('jquery');
		
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
		
		/**
		 * Creates a new Uint8Array based on two different ArrayBuffers
		 *
		 * @private
		 * @param {ArrayBuffers} buffer1 The first buffer.
		 * @param {ArrayBuffers} buffer2 The second buffer.
		 * @return {ArrayBuffers} The new ArrayBuffer created out of the two.
		 * 
		 * @memberOf SpeakJsWebAudioTTSImpl#
		 */
		var appendArrayBuffer = function(buffer1, buffer2) {
		  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
		  tmp.set(new Uint8Array(buffer1), 0);
		  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
		  return tmp.buffer;
		};
		/**  @memberOf SpeakJsWebAudioTTSImpl# */
		function writeString(view, offset, string){
			  for (var i = 0; i < string.length; i++){
			    view.setUint8(offset + i, string.charCodeAt(i));
			  }
			}
		/**  @memberOf SpeakJsWebAudioTTSImpl# */
		var addWaveHeadder = function(wavebuffer, sampleRate) {
			  var header = new ArrayBuffer(44);
			  var view = new DataView(header);
			  var mono = true;
			  
			  /* RIFF identifier */
			  writeString(view, 0, 'RIFF');
			  /* file length */
			  view.setUint32(4, 32 + wavebuffer.byteLength, true);
			  /* RIFF type */
			  writeString(view, 8, 'WAVE');
			  /* format chunk identifier */
			  writeString(view, 12, 'fmt ');
			  /* format chunk length */
			  view.setUint32(16, 16, true);
			  /* sample format (raw) */
			  view.setUint16(20, 1, true);
			  /* channel count */
			  view.setUint16(22, mono?1:2, true);
			  /* sample rate */
			  view.setUint32(24, sampleRate, true);
			  /* byte rate (sample rate * block align) */
			  view.setUint32(28, sampleRate * 4, true);
			  /* block align (channel count * bytes per sample) */
			  view.setUint16(32, 4, true);
			  /* bits per sample */
			  view.setUint16(34, 16, true);
			  /* data chunk identifier */
			  writeString(view, 36, 'data');
			  /* data chunk length */
			  view.setUint32(40, wavebuffer.byteLength, true);
			  
			  return appendArrayBuffer(header,wavebuffer);
			
		};
		
		///////////////////////////////////// HELPER for POST REQ /////////////////////////////////////////
		
		/**  @memberOf SpeakJsWebAudioTTSImpl# */
		var sendRequest = function(currSentence, audioObj, options, onend, onerror, oninit){
			
//			//default format/settings
//			var format = types.mp3;
			var samplerate = 22000;//russa: speak.js seems to generate wav with 22000 Hz sample rate
//			
//			if(options && options.format){
//				format = types.wav;
//			}
//			
//			if(options && options.rate){
//				//supported sample rates:
//				// WAV:  [8000,16000,22000]
//				// SPEX: [8000,16000]
//				samplerate = options.rate;
//			}
//			
//			//extend Audio's release()-function to cancel POST req. if one is set/active
//			/** @memberOf mmir.env.media.NuanceWebAudio */
//			audioObj.__release = audioObj.release;
//			/** @memberOf mmir.env.media.NuanceWebAudio */
//			audioObj._release = function(){
//				//cancel POST request, if one is active:
//				if(this.req){
//					console.log('aborting POST request: '+this.req);
//					this.req.abort();//<- this.req is set below when ajax is send
//					this.req = null;
//				}
//				return this.__release();
//			};
//			/** @memberOf mmir.env.media.NuanceWebAudio */
//			audioObj.release = audioObj._release;
			
			var ajaxSuccess = function(data){//, textStatus, jqXHR) {
					
				//console.log(oReq.response);
				
//				audioObj.req = null;
				
				//do not preceed, if audio was already canceled
				if(!audioObj.isEnabled()){
					return;///////////////// EARLY EXIT //////////////
				}
				
				var buffer=new ArrayBuffer(data.length);
		        new Uint8Array(buffer).set(data);
				
				//NOTE must use data arguement, since jqXHR does not contain appropriate response field for binary/non-text data
				var wav = addWaveHeadder(buffer, samplerate);
				
				var wavBlob = new Blob( [new DataView(wav)] );
				
//				console.log("Blob: "+wavBlob.size);
				//console.log(waveblob);
				
				_mediaManager.getWAVAsAudio(wavBlob,
						null,//<- do not need on-created callback, since we already loaded the audio-data at this point
						onend, onerror, oninit,
						audioObj
				);

					
			};
			
//			var ajaxFail = function(jqXHR, textStatus, errorThrown) {
//					
//				_mediaManager._log.error('Error code ' + jqXHR.status + ' for POST request: ' + textStatus + ', '+errorThrown);
//
//				//failurecallback:
//				onerror && onerror(textStatus + errorThrown, errorThrown);
//			};
//			
//			var options = {
//				url: reqUrl,
//				type: 'POST',
//				dataType: 'binary',					//avoid any conversion attempts by jQuery (if responseType is set, jQuery will set the response as binary field)
//				xhrFields: {
//					responseType: 'arraybuffer'		//set response type to binary/arraybuffer (i.e. the audio/*)
//				},
//				headers: {
//					'Content-Type': 'text/plain; charset=utf-8',
//					'Accept': format
//				},
//				processData: false,					//prevent jQuery from trying to process the (raw String) data
//				data: currSentence,
//				
//				success: ajaxSuccess,
//				error: ajaxFail
//			};
//			
//			audioObj.req = jquery.ajax(options);
			

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
		
		var workerPath = _consts.getWorkerPath() + 'speakWorkerExt.js';
		
		var _worker = new Worker(workerPath);
		var _pending = {};
		var _idCounter = 0;
		
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
	    //speakWorker.postMessage({ text: text, args: args });
		
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
